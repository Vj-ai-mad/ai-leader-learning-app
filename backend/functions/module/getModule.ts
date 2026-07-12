import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
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

    // Determine which day to return
    const pathParam = event.pathParameters?.dayIndex
    let dayIndex: number

    if (!pathParam || pathParam === 'today') {
      // GET /module/today — use currentDayIndex
      const userResult = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId }
      }))
      if (!userResult.Item) return res(404, { error: 'User not found' })
      dayIndex = userResult.Item.currentDayIndex ?? 0
      var planId = userResult.Item.planId
    } else {
      dayIndex = parseInt(pathParam, 10)
      if (isNaN(dayIndex)) return res(400, { error: 'Invalid dayIndex' })
      const userResult = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId }
      }))
      if (!userResult.Item) return res(404, { error: 'User not found' })
      var planId = userResult.Item.planId
    }

    if (!planId) return res(404, { error: 'No plan found for user' })

    // Fetch plan
    const planResult = await docClient.send(new GetCommand({
      TableName: PLANS_TABLE,
      Key: { planId }
    }))
    if (!planResult.Item) return res(404, { error: 'Plan not found' })

    const days = planResult.Item.days as Array<{
      dayIndex: number
      stageNumber: number
      contentId: string
      aiSummary: string
      completedAt: string | null
    }>

    if (dayIndex < 0 || dayIndex >= days.length) {
      return res(404, { error: 'Day not found in plan' })
    }

    const dayEntry = days[dayIndex]

    // Fetch content item for title, url, format, estimatedMinutes
    const contentResult = await docClient.send(new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { contentId: dayEntry.contentId }
    }))
    const content = contentResult.Item

    return res(200, {
      dayIndex: dayEntry.dayIndex,
      stageNumber: dayEntry.stageNumber,
      stageLabel: STAGE_LABELS[dayEntry.stageNumber] ?? `Stage ${dayEntry.stageNumber}`,
      contentId: dayEntry.contentId,
      title: content?.title ?? 'Untitled',
      url: content?.url ?? '',
      format: content?.format ?? 'article',
      estimatedMinutes: content?.estimatedMinutes ?? 15,
      aiSummary: dayEntry.aiSummary,
      completedAt: dayEntry.completedAt
    })
  } catch (err) {
    console.error('[getModule] Error:', err)
    return res(500, { error: 'Internal server error' })
  }
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
