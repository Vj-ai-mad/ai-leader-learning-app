import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { docClient } from '../shared/dynamodb'
import { bedrockClient } from '../shared/bedrock'
import { randomUUID } from 'crypto'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'
const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

interface ContentItem {
  contentId: string
  title: string
  stage: number
  roleRelevance: string[] | Set<string>
  format: string
  estimatedMinutes: number
  tags: string[] | Set<string>
  aiSummary: string
}

/**
 * Plan generation strategy:
 * 1. Read all seeded content items (already have aiSummary)
 * 2. TRY: lightweight Bedrock call to order items based on user's role,
 *    responsibilities, and career goal (personalization)
 * 3. FALLBACK: if Bedrock fails, sequence deterministically by stage + role relevance
 * 4. Use pre-existing aiSummary from content items — never regenerate summaries
 */

export async function handler(event: unknown): Promise<APIGatewayProxyResultV2 | void> {
  if (isApiEvent(event) && event.requestContext.http.method === 'GET') {
    return handleStatusCheck(event)
  }

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
    const allItems = (contentResult.Items ?? []) as ContentItem[]

    if (allItems.length < 42) {
      console.error(`[generatePlan] Only ${allItems.length} content items (need 42+)`)
      await setUserPlanStatus(userId, 'error')
      return
    }

    // 3. Try personalized ordering via Bedrock, fall back to deterministic
    let orderedIds: string[]
    try {
      orderedIds = await getPersonalizedOrder(user, allItems)
      console.log('[generatePlan] Using Bedrock-personalized ordering')
    } catch (err) {
      console.warn('[generatePlan] Bedrock ordering failed, using deterministic fallback:', err)
      orderedIds = getDeterministicOrder(allItems, user.role ?? 'General')
    }

    // 4. Build plan using ordered IDs and pre-existing aiSummary
    const itemMap = new Map(allItems.map(i => [i.contentId, i]))
    const planItems = orderedIds
      .map(id => itemMap.get(id))
      .filter((item): item is ContentItem => !!item)

    if (planItems.length < 42) {
      // Bedrock returned fewer items — pad with remaining items
      const usedIds = new Set(orderedIds)
      const remaining = allItems
        .filter(i => !usedIds.has(i.contentId))
        .sort((a, b) => a.stage - b.stage)
      planItems.push(...remaining.slice(0, 56 - planItems.length))
    }

    const planId = randomUUID()
    const now = new Date().toISOString()

    const days = planItems.slice(0, 56).map((item, i) => ({
      dayIndex: i,
      stageNumber: item.stage,
      contentId: item.contentId,
      aiSummary: item.aiSummary || `Learn about: ${item.title}`,
      completedAt: null
    }))

    await docClient.send(new PutCommand({
      TableName: PLANS_TABLE,
      Item: { planId, userId, generatedAt: now, totalDays: days.length, days }
    }))

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET planId = :planId, planStatus = :active, currentDayIndex = :zero, totalDays = :total, updatedAt = :now',
      ExpressionAttributeValues: {
        ':planId': planId, ':active': 'active', ':zero': 0, ':total': days.length, ':now': now
      }
    }))

    console.log(`[generatePlan] Success: planId=${planId}, ${days.length} days`)
  } catch (err) {
    console.error('[generatePlan] Error:', err)
    await setUserPlanStatus(userId, 'error')
  }
}

// ── Personalized ordering via Bedrock (lightweight call) ───────────────────

async function getPersonalizedOrder(user: Record<string, unknown>, items: ContentItem[]): Promise<string[]> {
  const itemList = items.map(i => ({
    id: i.contentId,
    title: i.title,
    stage: i.stage,
    tags: Array.isArray(i.tags) ? i.tags : Array.from(i.tags as Set<string>)
  }))

  const prompt = `You are sequencing a personalized learning plan for a delivery leader.

Learner profile:
- Role: ${user.role}
- Current responsibilities: ${user.responsibilities || 'Not specified'}
- 5-year career goal: ${user.careerGoal || 'Not specified'}
- Daily time: ${user.dailyMinutes} minutes

Content items (JSON):
${JSON.stringify(itemList)}

Instructions:
- Return ONLY a JSON array of contentId strings in the recommended learning order
- Maintain stage progression (1->2->3->4->5) but within each stage, prioritize items most relevant to this learner's responsibilities and goals
- Include ALL items — do not skip any
- Return nothing else, just the JSON array of IDs`

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  }))

  const body = JSON.parse(new TextDecoder().decode(response.body))
  const text = body.content?.[0]?.text ?? ''

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in response')

  const ids: string[] = JSON.parse(match[0])
  if (!Array.isArray(ids) || ids.length < 40) {
    throw new Error(`Too few IDs returned: ${ids.length}`)
  }

  return ids
}

// ── Deterministic fallback (zero cost) ─────────────────────────────────────

function getDeterministicOrder(items: ContentItem[], role: string): string[] {
  return items
    .sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage
      const aRelevant = hasRole(a.roleRelevance, role) ? 0 : 1
      const bRelevant = hasRole(b.roleRelevance, role) ? 0 : 1
      return aRelevant - bRelevant
    })
    .map(i => i.contentId)
}

// ── Status check (GET /plan/status) ────────────────────────────────────────

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

function hasRole(roleRelevance: string[] | Set<string>, role: string): boolean {
  if (roleRelevance instanceof Set) return roleRelevance.has(role) || roleRelevance.has('General')
  return roleRelevance.includes(role) || roleRelevance.includes('General')
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
