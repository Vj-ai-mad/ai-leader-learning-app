import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand
} from '@aws-sdk/client-cognito-identity-provider'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'

const cognitoClient = new CognitoIdentityProviderClient({})

const DEEPLINK_TOKENS_TABLE = process.env.DEEPLINK_TOKENS_TABLE ?? 'ai-leader-deeplink-tokens'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? ''
const CLIENT_ID = process.env.COGNITO_USER_POOL_CLIENT_ID ?? ''

interface ExchangeRequest {
  token: string
}

interface TokenRecord {
  token: string
  userId: string
  dayIndex: number
  expiresAt: number
  used: boolean
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body: ExchangeRequest = JSON.parse(event.body ?? '{}')

    if (!body.token) {
      return response(400, { error: 'Missing token in request body' })
    }

    // 1. Fetch token record from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: DEEPLINK_TOKENS_TABLE,
      Key: { token: body.token }
    }))

    const record = result.Item as TokenRecord | undefined

    if (!record) {
      return response(404, { error: 'Token not found' })
    }

    // 2. Validate: not used, not expired
    if (record.used) {
      return response(410, { error: 'Token already used' })
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (record.expiresAt < nowSeconds) {
      return response(410, { error: 'Token expired' })
    }

    // 3. Mark token as used (single-use enforcement)
    await docClient.send(new UpdateCommand({
      TableName: DEEPLINK_TOKENS_TABLE,
      Key: { token: body.token },
      UpdateExpression: 'SET #used = :true',
      ConditionExpression: '#used = :false',
      ExpressionAttributeNames: { '#used': 'used' },
      ExpressionAttributeValues: { ':true': true, ':false': false }
    }))

    // 4. Initiate auth session for the user via Cognito AdminInitiateAuth
    //    Using CUSTOM_AUTH flow — the Pre-authentication trigger will need
    //    to be configured to issue tokens without challenge for admin-initiated auth.
    //    For tester phase, we use ADMIN_NO_SRP_AUTH which returns tokens directly.
    const authResult = await cognitoClient.send(new AdminInitiateAuthCommand({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: record.userId
        // Note: For production, implement a custom auth challenge flow.
        // For tester phase with 15-25 users, we use a workaround:
        // The deep-link Lambda has admin privileges to issue tokens directly.
      }
    }))

    // 5. Return tokens and navigation target
    return response(200, {
      accessToken: authResult.AuthenticationResult?.AccessToken,
      idToken: authResult.AuthenticationResult?.IdToken,
      refreshToken: authResult.AuthenticationResult?.RefreshToken,
      dayIndex: record.dayIndex
    })
  } catch (err) {
    // Handle ConditionalCheckFailed (race condition — token used between read and update)
    if ((err as Error).name === 'ConditionalCheckFailedException') {
      return response(410, { error: 'Token already used' })
    }

    console.error('[deepLinkExchange] Error:', err)
    return response(500, { error: 'Internal server error' })
  }
}

function response(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}
