import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'

const ALLOWLIST_TABLE = process.env.ALLOWLIST_TABLE ?? 'ai-leader-allowlist'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = JSON.parse(event.body ?? '{}')
    const { email, phone } = body

    if (!email && !phone) {
      return res(400, { error: 'email or phone required', allowed: false })
    }

    const [emailCheck, phoneCheck] = await Promise.all([
      email ? docClient.send(new GetCommand({ TableName: ALLOWLIST_TABLE, Key: { value: email } })) : null,
      phone ? docClient.send(new GetCommand({ TableName: ALLOWLIST_TABLE, Key: { value: phone } })) : null
    ])

    const allowed = !!(emailCheck?.Item || phoneCheck?.Item)

    return res(200, { allowed })
  } catch (err) {
    console.error('[checkAllowList] Error:', err)
    return res(500, { error: 'Internal server error', allowed: false })
  }
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}
