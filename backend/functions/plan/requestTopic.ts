import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { docClient } from '../shared/dynamodb'
import { bedrockClient } from '../shared/bedrock'
import { randomUUID } from 'crypto'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'
const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

/**
 * POST /plan/request-topic
 * Body: { topic: string }
 *
 * 1. Calls Bedrock to generate a 300-500 word lesson on the requested topic
 * 2. Saves as a Content item (reviewedByAdmin: false, userId: requester)
 * 3. Appends the new module to the user's existing plan as an extra day
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string
    if (!userId) return res(401, { error: 'Unauthorized' })

    const body = JSON.parse(event.body ?? '{}')
    const topic = (body.topic ?? '').trim()

    if (!topic || topic.length < 3) {
      return res(400, { error: 'Topic must be at least 3 characters' })
    }

    if (topic.length > 200) {
      return res(400, { error: 'Topic must be under 200 characters' })
    }

    // Get user profile for role context
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }))
    const user = userResult.Item
    if (!user) return res(404, { error: 'User not found' })

    // Call Bedrock to generate content
    const role = user.role ?? 'Delivery Manager'
    const prompt = `Write an original 300-500 word lesson for a ${role} on this topic: "${topic}". Assume no technical background beyond general software delivery experience. End with one practical takeaway they can apply this week. If this topic is not related to AI, technology leadership, delivery management, or professional skill-building, politely decline and suggest a related topic instead.`

    let aiSummary: string
    try {
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

      const responseBody = JSON.parse(new TextDecoder().decode(response.body))
      aiSummary = responseBody.content?.[0]?.text ?? ''
    } catch (err) {
      console.error('[requestTopic] Bedrock error:', err)
      // Fallback: save the topic as a placeholder for later generation
      aiSummary = `[Pending AI generation] Topic requested: ${topic}. Content will be generated when the AI service is available.`
    }

    // Create content item (user-specific, not reviewed)
    const contentId = `user-${userId}-${randomUUID().slice(0, 8)}`
    const now = new Date().toISOString()

    await docClient.send(new PutCommand({
      TableName: CONTENT_TABLE,
      Item: {
        contentId,
        title: topic,
        url: `#user-requested-${contentId}`,
        format: 'article',
        stage: 6, // Beyond the 5 core stages — marks it as user-requested
        roleRelevance: new Set([role, 'General']),
        tags: new Set(['user-requested', role.toLowerCase()]),
        aiSummary,
        estimatedMinutes: 15,
        active: 'true',
        reviewedByAdmin: false,
        requestedBy: userId,
        createdAt: now,
        updatedAt: now
      }
    }))

    // Append to user's plan as an extra day
    const planId = user.planId
    if (planId) {
      const planResult = await docClient.send(new GetCommand({
        TableName: PLANS_TABLE,
        Key: { planId }
      }))
      const plan = planResult.Item
      if (plan?.days) {
        const newDayIndex = plan.days.length
        const newDay = {
          dayIndex: newDayIndex,
          stageNumber: 6,
          contentId,
          aiSummary,
          completedAt: null
        }

        await docClient.send(new UpdateCommand({
          TableName: PLANS_TABLE,
          Key: { planId },
          UpdateExpression: 'SET #days = list_append(#days, :newDay), totalDays = :total',
          ExpressionAttributeNames: { '#days': 'days' },
          ExpressionAttributeValues: {
            ':newDay': [newDay],
            ':total': newDayIndex + 1
          }
        }))

        // Update user's totalDays
        await docClient.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId },
          UpdateExpression: 'SET totalDays = :total, updatedAt = :now',
          ExpressionAttributeValues: { ':total': newDayIndex + 1, ':now': now }
        }))
      }
    }

    return res(200, {
      contentId,
      title: topic,
      aiSummary,
      message: 'Topic added to your plan'
    })
  } catch (err) {
    console.error('[requestTopic] Error:', err)
    return res(500, { error: 'Failed to process topic request' })
  }
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
