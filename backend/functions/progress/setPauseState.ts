import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string
    if (!userId) return res(401, { error: 'Unauthorized' })

    const body = JSON.parse(event.body ?? '{}')
    const path = event.requestContext.http.path
    const now = new Date().toISOString()

    // PATCH /profile/notifications
    if (path.includes('/notifications')) {
      const { notifOptOut } = body
      if (typeof notifOptOut !== 'boolean') {
        return res(400, { error: 'notifOptOut must be a boolean' })
      }
      await docClient.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: 'SET notifOptOut = :v, updatedAt = :now',
        ExpressionAttributeValues: { ':v': notifOptOut, ':now': now }
      }))
      return res(200, { notifOptOut })
    }

    // PATCH /progress/pause
    const { paused } = body
    if (typeof paused !== 'boolean') {
      return res(400, { error: 'paused must be a boolean' })
    }

    const newStatus = paused ? 'paused' : 'active'
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET planStatus = :s, updatedAt = :now',
      ExpressionAttributeValues: { ':s': newStatus, ':now': now }
    }))

    return res(200, { planStatus: newStatus })
  } catch (err) {
    console.error('[setPauseState] Error:', err)
    return res(500, { error: 'Internal server error' })
  }
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
