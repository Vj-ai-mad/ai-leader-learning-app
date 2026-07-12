import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'
import { randomUUID } from 'crypto'

const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    if (!isAdmin(event)) return res(403, { error: 'Forbidden' })

    const method = event.requestContext.http.method

    // GET /admin/content — list all
    if (method === 'GET') {
      const result = await docClient.send(new ScanCommand({
        TableName: CONTENT_TABLE
      }))
      return res(200, { items: result.Items ?? [] })
    }

    // PUT /admin/content/:contentId — create or update
    if (method === 'PUT') {
      const body = JSON.parse(event.body ?? '{}')
      const contentId = event.pathParameters?.contentId ?? randomUUID()
      const now = new Date().toISOString()

      if (!body.title || !body.url || !body.format || !body.stage) {
        return res(400, { error: 'title, url, format, and stage are required' })
      }

      const item = {
        contentId,
        title: body.title,
        url: body.url,
        format: body.format,
        stage: body.stage,
        roleRelevance: body.roleRelevance ?? ['General'],
        tags: body.tags ?? [],
        aiSummary: body.aiSummary ?? '',
        estimatedMinutes: body.estimatedMinutes ?? 15,
        active: body.active ?? true,
        reviewedByAdmin: body.reviewedByAdmin ?? false,
        createdAt: body.createdAt ?? now,
        updatedAt: now
      }

      await docClient.send(new PutCommand({
        TableName: CONTENT_TABLE,
        Item: item
      }))

      return res(200, item)
    }

    return res(405, { error: 'Method not allowed' })
  } catch (err) {
    console.error('[upsertContent] Error:', err)
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
