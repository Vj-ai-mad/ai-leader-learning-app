import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string
    if (!userId) return res(401, { error: 'Unauthorized' })

    const dayIndex = parseInt(event.pathParameters?.dayIndex ?? '', 10)
    if (isNaN(dayIndex)) return res(400, { error: 'Invalid dayIndex' })

    // Get user record
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE, Key: { userId }
    }))
    const user = userResult.Item
    if (!user) return res(404, { error: 'User not found' })

    const planId = user.planId
    if (!planId) return res(404, { error: 'No plan found' })

    // Mark day as complete in plan
    const now = new Date().toISOString()
    const today = now.slice(0, 10) // YYYY-MM-DD

    await docClient.send(new UpdateCommand({
      TableName: PLANS_TABLE,
      Key: { planId },
      UpdateExpression: `SET #days[${dayIndex}].completedAt = :now`,
      ExpressionAttributeNames: { '#days': 'days' },
      ExpressionAttributeValues: { ':now': now }
    }))

    // Calculate streak
    const lastDate = user.lastCompletionDate as string | undefined
    let newStreak = 1

    if (lastDate) {
      const lastDateObj = new Date(lastDate)
      const todayObj = new Date(today)
      const diffMs = todayObj.getTime() - lastDateObj.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        // Same day — keep existing streak
        newStreak = user.streakCount ?? 1
      } else if (diffDays === 1) {
        // Consecutive day — increment
        newStreak = (user.streakCount ?? 0) + 1
      }
      // else: gap > 1 day — reset to 1
    }

    // Advance currentDayIndex if this was the current day
    const newDayIndex = dayIndex === user.currentDayIndex
      ? user.currentDayIndex + 1
      : user.currentDayIndex

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET streakCount = :streak, lastCompletionDate = :today, currentDayIndex = :dayIdx, updatedAt = :now',
      ExpressionAttributeValues: {
        ':streak': newStreak,
        ':today': today,
        ':dayIdx': newDayIndex,
        ':now': now
      }
    }))

    return res(200, { streakCount: newStreak, currentDayIndex: newDayIndex })
  } catch (err) {
    console.error('[completeModule] Error:', err)
    return res(500, { error: 'Internal server error' })
  }
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
