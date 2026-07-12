import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { docClient } from '../shared/dynamodb'
import { bedrockClient } from '../shared/bedrock'
import { randomUUID } from 'crypto'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'
const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-20250514-v1:0'

interface ContentItem {
  contentId: string
  title: string
  stage: number
  roleRelevance: string[]
  format: string
  estimatedMinutes: number
  tags: string[]
}

interface GeneratedDay {
  dayIndex: number
  stageNumber: number
  contentId: string
  aiSummary: string
}

// Can be invoked async (from submitOnboarding) or via GET /plan/status
export async function handler(event: unknown): Promise<APIGatewayProxyResultV2 | void> {
  // If it's an API Gateway event with GET method, return plan status
  if (isApiEvent(event) && event.requestContext.http.method === 'GET') {
    return handleStatusCheck(event)
  }

  // Otherwise it's an async invocation for plan generation
  const payload = event as { userId: string }
  const userId = payload.userId
  if (!userId) {
    console.error('[generatePlan] No userId in event')
    return
  }

  try {
    // 1. Read user profile
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }))
    const user = userResult.Item
    if (!user) throw new Error(`User ${userId} not found`)

    // 2. Scan content library (active + reviewed)
    const contentResult = await docClient.send(new ScanCommand({
      TableName: CONTENT_TABLE,
      FilterExpression: '#active = :activeVal AND reviewedByAdmin = :true',
      ExpressionAttributeNames: { '#active': 'active' },
      ExpressionAttributeValues: { ':activeVal': 'true', ':true': true }
    }))
    const contentItems = (contentResult.Items ?? []) as ContentItem[]

    if (contentItems.length < 42) {
      console.error(`[generatePlan] Only ${contentItems.length} content items available (need 42+)`)
      await setUserPlanStatus(userId, 'error')
      return
    }

    // 3. Build Bedrock prompt
    const prompt = buildPrompt(user, contentItems)

    // 4. Call Bedrock
    const bedrockResponse = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 8192,
        messages: [
          { role: 'user', content: prompt }
        ],
        system: buildSystemPrompt()
      })
    }))

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body))
    const assistantText = responseBody.content?.[0]?.text ?? ''

    // 5. Parse JSON from response
    const jsonMatch = assistantText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found in Bedrock response')

    const days: GeneratedDay[] = JSON.parse(jsonMatch[0])

    if (!Array.isArray(days) || days.length < 42) {
      throw new Error(`Plan too short: ${days.length} days (need 42+)`)
    }

    // 6. Write plan to DynamoDB
    const planId = randomUUID()
    const now = new Date().toISOString()

    await docClient.send(new PutCommand({
      TableName: PLANS_TABLE,
      Item: {
        planId,
        userId,
        generatedAt: now,
        totalDays: days.length,
        days: days.map((d, i) => ({
          dayIndex: i,
          stageNumber: d.stageNumber,
          contentId: d.contentId,
          aiSummary: d.aiSummary,
          completedAt: null
        }))
      }
    }))

    // 7. Update user record
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET planId = :planId, planStatus = :active, currentDayIndex = :zero, updatedAt = :now',
      ExpressionAttributeValues: {
        ':planId': planId,
        ':active': 'active',
        ':zero': 0,
        ':now': now
      }
    }))

    console.log(`[generatePlan] Success: planId=${planId}, ${days.length} days for user ${userId}`)
  } catch (err) {
    console.error('[generatePlan] Error:', err)
    await setUserPlanStatus(userId, 'error')
  }
}

// ── Status check handler (GET /plan/status) ────────────────────────────────

async function handleStatusCheck(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string
  if (!userId) return res(401, { error: 'Unauthorized' })

  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    ProjectionExpression: 'planStatus, currentDayIndex, totalDays'
  }))

  if (!result.Item) return res(404, { error: 'User not found' })

  return res(200, {
    planStatus: result.Item.planStatus,
    currentDayIndex: result.Item.currentDayIndex ?? 0,
    totalDays: result.Item.totalDays ?? 0
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a learning plan designer for delivery leaders. You create day-by-day AI literacy learning plans using a curated content library. Each plan covers 6-8 weeks. Respond only with a valid JSON array matching the schema provided. Do not include any other text.`
}

function buildPrompt(user: Record<string, unknown>, items: ContentItem[]): string {
  const itemList = items.map(i => ({
    contentId: i.contentId,
    title: i.title,
    stage: i.stage,
    roleRelevance: i.roleRelevance,
    format: i.format,
    estimatedMinutes: i.estimatedMinutes,
    tags: i.tags
  }))

  return `Learner profile:
- Role: ${user.role}
- Responsibilities: ${user.responsibilities || 'Not specified'}
- 5-year goal: ${user.careerGoal || 'Not specified'}
- Daily time available: ${user.dailyMinutes} minutes

Content library (JSON array):
${JSON.stringify(itemList)}

Instructions:
1. Select and sequence content items across all 5 stages in order (1 then 2 then 3 then 4 then 5)
2. Prioritise items where roleRelevance includes "${user.role}" or "General"
3. Each day gets exactly one item whose estimatedMinutes <= ${user.dailyMinutes}
4. Generate 42-56 days total
5. For each selected item write an original aiSummary of 300-400 words that orients the learner without reproducing the source text
6. Return ONLY a JSON array: [{"dayIndex":0,"stageNumber":1,"contentId":"...","aiSummary":"..."},...]`
}

async function setUserPlanStatus(userId: string, status: string) {
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: 'SET planStatus = :s, updatedAt = :now',
    ExpressionAttributeValues: { ':s': status, ':now': new Date().toISOString() }
  }))
}

function isApiEvent(event: unknown): event is APIGatewayProxyEventV2 {
  return !!(event as APIGatewayProxyEventV2)?.requestContext?.http
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
