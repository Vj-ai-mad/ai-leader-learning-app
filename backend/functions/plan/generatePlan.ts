import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'
import { randomUUID } from 'crypto'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'
const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'

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
 * Plan generation strategy (cost-optimized):
 * 1. Read all seeded content items from DynamoDB (already have aiSummary)
 * 2. Filter by user's dailyMinutes budget and role relevance
 * 3. Sequence items in stage order (1->2->3->4->5)
 * 4. Use the pre-existing aiSummary from each content item — NO Bedrock call
 *
 * This approach costs $0 per plan generation (only DynamoDB reads).
 * Bedrock was already used once during seed to generate the summaries.
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

    // 3. Filter by user's time budget
    const dailyMinutes = user.dailyMinutes ?? 25
    const userRole = user.role ?? 'General'

    const eligible = allItems.filter(
      item => item.estimatedMinutes <= dailyMinutes
    )

    // 4. Sort by stage order, prioritize role-relevant items
    const sorted = eligible.sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage
      const aRelevant = hasRole(a.roleRelevance, userRole) ? 0 : 1
      const bRelevant = hasRole(b.roleRelevance, userRole) ? 0 : 1
      return aRelevant - bRelevant
    })

    // 5. Take 42-46 items (all available up to 56 max)
    const planItems = sorted.slice(0, Math.min(sorted.length, 56))

    if (planItems.length < 42) {
      console.error(`[generatePlan] Only ${planItems.length} eligible items after filtering`)
      await setUserPlanStatus(userId, 'error')
      return
    }

    // 6. Build plan using pre-existing aiSummary — NO Bedrock call
    const planId = randomUUID()
    const now = new Date().toISOString()

    const days = planItems.map((item, i) => ({
      dayIndex: i,
      stageNumber: item.stage,
      contentId: item.contentId,
      aiSummary: item.aiSummary || `Learn about: ${item.title}`,
      completedAt: null
    }))

    await docClient.send(new PutCommand({
      TableName: PLANS_TABLE,
      Item: {
        planId,
        userId,
        generatedAt: now,
        totalDays: days.length,
        days
      }
    }))

    // 7. Update user record
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET planId = :planId, planStatus = :active, currentDayIndex = :zero, totalDays = :total, updatedAt = :now',
      ExpressionAttributeValues: {
        ':planId': planId,
        ':active': 'active',
        ':zero': 0,
        ':total': days.length,
        ':now': now
      }
    }))

    console.log(`[generatePlan] Success: planId=${planId}, ${days.length} days for user ${userId} (no Bedrock call — used pre-seeded summaries)`)
  } catch (err) {
    console.error('[generatePlan] Error:', err)
    await setUserPlanStatus(userId, 'error')
  }
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
  if (roleRelevance instanceof Set) {
    return roleRelevance.has(role) || roleRelevance.has('General')
  }
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
