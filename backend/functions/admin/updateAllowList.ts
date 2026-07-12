import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'

const ALLOWLIST_TABLE = process.env.ALLOWLIST_TABLE ?? 'ai-leader-allowlist'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    if (!isAdmin(event)) return res(403, { error: 'Forbidden' })

    const method = event.requestContext.http.method

    // GET /admin/allowlist
    if (method === 'GET') {
      const result = await docClient.send(new ScanCommand({
        TableName: ALLOWLIST_TABLE
      }))
      return res(200, { items: result.Items ?? [] })
    }

    // POST /admin/allowlist
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}')
      if (!body.value || !body.type) {
        return res(400, { error: 'value and type are required' })
      }
      const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string
      await docClient.send(new PutCommand({
        TableName: ALLOWLIST_TABLE,
        Item: {
          value: body.value,
          type: body.type,
          note: body.note ?? '',
          addedAt: new Date().toISOString(),
          addedBy: userId ?? 'admin'
        }
      }))
      return res(201, { value: body.value, type: body.type })
    }

    // DELETE /admin/allowlist/:value
    if (method === 'DELETE') {
      const value = decodeURIComponent(event.pathParameters?.value ?? '')
      if (!value) return res(400, { error: 'value path param required' })
      await docClient.send(new DeleteCommand({
        TableName: ALLOWLIST_TABLE,
        Key: { value }
      }))
      return res(200, { deleted: value })
    }

    return res(405, { error: 'Method not allowed' })
  } catch (err) {
    console.error('[updateAllowList] Error:', err)
    return res(500, { error: 'Internal server error' })
  }
}

function isAdmin(event: APIGatewayProxyEventV2): boolean {
  const groups = event.requestContext.authorizer?.jwt?.claims?.['cognito:groups']
  if (Array.isArray(groups)) return groups.includes('admin')
  if (typeof groups === 'string') return groups.includes('admin')
  return false
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
