import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'
const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'

const STAGE_LABELS: Record<number, string> = {
  1: 'AI Literacy Foundations',
  2: 'AI in Delivery & Program Management',
  3: 'Leading AI-enabled Initiatives',
  4: 'Governance, Risk & Responsible AI',
  5: 'Becoming the AI-fluent Leader'
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string
    if (!userId) return res(401, { error: 'Unauthorized' })

    const path = event.requestContext.http.path

    // GET /profile
    if (path.endsWith('/profile')) {
      return handleProfile(userId)
    }

    // GET /progress
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE, Key: { userId }
    }))
    const user = userResult.Item
    if (!user) return res(404, { error: 'User not found' })

    if (!user.planId) {
      return res(200, {
        planStatus: user.planStatus,
        currentDayIndex: 0,
        totalDays: 0,
        streakCount: 0,
        stages: []
      })
    }

    const planResult = await docClient.send(new GetCommand({
      TableName: PLANS_TABLE, Key: { planId: user.planId }
    }))
    const plan = planResult.Item
    if (!plan) return res(404, { error: 'Plan not found' })

    const days = plan.days as Array<{
      dayIndex: number
      stageNumber: number
      contentId: string
      aiSummary: string
      completedAt: string | null
    }>

    // Fetch content titles
    const contentResult = await docClient.send(new ScanCommand({
      TableName: CONTENT_TABLE,
      ProjectionExpression: 'contentId, title'
    }))
    const titleMap = new Map<string, string>()
    for (const item of contentResult.Items ?? []) {
      titleMap.set(item.contentId as string, item.title as string)
    }

    // Group by stage
    const stageMap = new Map<number, typeof days>()
    for (const d of days) {
      if (!stageMap.has(d.stageNumber)) stageMap.set(d.stageNumber, [])
      stageMap.get(d.stageNumber)!.push(d)
    }

    const stages = Array.from(stageMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([stageNumber, modules]) => ({
        stageNumber,
        stageLabel: STAGE_LABELS[stageNumber] ?? `Stage ${stageNumber}`,
        totalModules: modules.length,
        completedModules: modules.filter(m => m.completedAt).length,
        modules: modules.map(m => ({
          dayIndex: m.dayIndex,
          title: titleMap.get(m.contentId) ?? `Module ${m.dayIndex + 1}`,
          completedAt: m.completedAt
        }))
      }))

    return res(200, {
      planStatus: user.planStatus,
      currentDayIndex: user.currentDayIndex ?? 0,
      totalDays: days.length,
      streakCount: user.streakCount ?? 0,
      stages
    })
  } catch (err) {
    console.error('[getProgress] Error:', err)
    return res(500, { error: 'Internal server error' })
  }
}

async function handleProfile(userId: string): Promise<APIGatewayProxyResultV2> {
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    ProjectionExpression: '#name, #role, dailyMinutes, activeDays, notifOptOut',
    ExpressionAttributeNames: { '#name': 'name', '#role': 'role' }
  }))
  if (!result.Item) return res(404, { error: 'User not found' })
  return res(200, result.Item)
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
