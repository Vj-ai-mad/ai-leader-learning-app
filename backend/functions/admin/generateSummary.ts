import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { docClient } from '../shared/dynamodb'
import { bedrockClient } from '../shared/bedrock'

const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-haiku-20240307-v1:0'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    if (!isAdmin(event)) return res(403, { error: 'Forbidden' })

    const contentId = event.pathParameters?.contentId
    if (!contentId) return res(400, { error: 'contentId required' })

    const result = await docClient.send(new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { contentId }
    }))
    if (!result.Item) return res(404, { error: 'Content not found' })

    const { title, url, tags } = result.Item

    const prompt = `Write an original 300-400 word summary for a delivery leader about this resource. Orient the reader toward key concepts and practical takeaways. Do NOT reproduce the source text.

Title: ${title}
URL: ${url}
Tags: ${(tags ?? []).join(', ')}`

    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    }))

    const body = JSON.parse(new TextDecoder().decode(response.body))
    const aiSummary = body.content?.[0]?.text ?? ''

    return res(200, { aiSummary })
  } catch (err) {
    console.error('[generateSummary] Error:', err)
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
