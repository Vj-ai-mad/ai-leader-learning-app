import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { docClient } from '../shared/dynamodb'

const lambdaClient = new LambdaClient({})
const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const GENERATE_PLAN_FN = process.env.GENERATE_PLAN_FN ?? ''

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string
    if (!userId) return res(401, { error: 'Unauthorized' })

    const body = JSON.parse(event.body ?? '{}')
    const { role, responsibilities, careerGoal, dailyMinutes, activeDays } = body

    // Validate required fields
    if (!role || !dailyMinutes || !activeDays?.length) {
      return res(400, { error: 'role, dailyMinutes, and activeDays are required' })
    }

    const now = new Date().toISOString()

    // Save onboarding data
    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        userId,
        role,
        responsibilities: responsibilities ?? '',
        careerGoal: careerGoal ?? '',
        dailyMinutes,
        activeDays,
        onboardingComplete: true,
        planStatus: 'generating',
        currentDayIndex: 0,
        streakCount: 0,
        notifOptOut: false,
        createdAt: now,
        updatedAt: now
      }
    }))

    // Asynchronously invoke generatePlan Lambda
    await lambdaClient.send(new InvokeCommand({
      FunctionName: GENERATE_PLAN_FN,
      InvocationType: 'Event', // fire-and-forget
      Payload: Buffer.from(JSON.stringify({ userId }))
    }))

    return res(200, { planStatus: 'generating' })
  } catch (err) {
    console.error('[submitOnboarding] Error:', err)
    return res(500, { error: 'Internal server error' })
  }
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
