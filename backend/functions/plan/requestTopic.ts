import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'
import { getAnthropicClient, MODEL } from '../shared/anthropic'
import { randomUUID } from 'crypto'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'
const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'
const MAX_TOPIC_REQUESTS_PER_USER = 5

interface GeneratedModule {
  title: string
  lesson: string
}

/**
 * POST /plan/request-topic
 * Body: { topic: string }
 *
 * 1. Calls Bedrock to:
 *    - Detect if input contains multiple topics and split them
 *    - Generate a clean title-cased title for each
 *    - Generate a 300-500 word lesson for each
 * 2. Saves each as a Content item (reviewedByAdmin: false, originalRequest preserved)
 * 3. Appends each to the user's plan as extra days
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string
    if (!userId) return res(401, { error: 'Unauthorized' })

    const body = JSON.parse(event.body ?? '{}')
    const rawTopic = (body.topic ?? '').trim()

    if (!rawTopic || rawTopic.length < 3) {
      return res(400, { error: 'Topic must be at least 3 characters' })
    }
    if (rawTopic.length > 500) {
      return res(400, { error: 'Topic must be under 500 characters' })
    }

    // Get user profile for role context
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE, Key: { userId }
    }))
    const user = userResult.Item
    if (!user) return res(404, { error: 'User not found' })

    // Enforce per-user cap
    const topicRequestCount = (user.topicRequestCount as number) ?? 0
    if (topicRequestCount >= MAX_TOPIC_REQUESTS_PER_USER) {
      return res(429, { error: `Maximum of ${MAX_TOPIC_REQUESTS_PER_USER} topic requests reached.` })
    }

    const role = user.role ?? 'Delivery Manager'

    // Call Bedrock: split topics, generate clean titles + lessons
    const modules = await generateModules(rawTopic, role)

    // Save each module and append to plan
    const results: { contentId: string; title: string }[] = []
    const planId = user.planId

    for (const mod of modules) {
      const contentId = `user-${userId}-${randomUUID().slice(0, 8)}`
      const now = new Date().toISOString()

      await docClient.send(new PutCommand({
        TableName: CONTENT_TABLE,
        Item: {
          contentId,
          title: mod.title,
          url: `#user-requested-${contentId}`,
          format: 'article',
          stage: 6,
          roleRelevance: new Set([role, 'General']),
          tags: new Set(['user-requested', role.toLowerCase()]),
          aiSummary: mod.lesson,
          estimatedMinutes: 15,
          active: 'true',
          reviewedByAdmin: false,
          requestedBy: userId,
          originalRequest: rawTopic,
          createdAt: now,
          updatedAt: now
        }
      }))

      // Append to plan
      if (planId) {
        const planResult = await docClient.send(new GetCommand({
          TableName: PLANS_TABLE, Key: { planId }
        }))
        const plan = planResult.Item
        if (plan?.days) {
          const newDayIndex = plan.days.length
          await docClient.send(new UpdateCommand({
            TableName: PLANS_TABLE,
            Key: { planId },
            UpdateExpression: 'SET #days = list_append(#days, :newDay), totalDays = :total',
            ExpressionAttributeNames: { '#days': 'days' },
            ExpressionAttributeValues: {
              ':newDay': [{ dayIndex: newDayIndex, stageNumber: 6, contentId, aiSummary: mod.lesson, completedAt: null }],
              ':total': newDayIndex + 1
            }
          }))

          await docClient.send(new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { userId },
            UpdateExpression: 'SET totalDays = :total, updatedAt = :now, topicRequestCount = if_not_exists(topicRequestCount, :zero) + :one',
            ExpressionAttributeValues: { ':total': newDayIndex + 1, ':now': now, ':zero': 0, ':one': 1 }
          }))
        }
      }

      results.push({ contentId, title: mod.title })
    }

    return res(200, {
      modules: results,
      message: `${results.length} module(s) added to your plan`
    })
  } catch (err) {
    console.error('[requestTopic] Error:', err)
    return res(500, { error: 'Failed to process topic request' })
  }
}

async function generateModules(rawInput: string, role: string): Promise<GeneratedModule[]> {
  const prompt = `You are creating learning modules for a ${role} in a delivery leadership AI literacy program.

The user submitted this topic request (may contain typos or multiple topics crammed together):
"${rawInput}"

Instructions:
1. If the input contains multiple distinct topics, split them into separate modules (max 4).
2. For each module, generate:
   - A clean, properly-worded, title-cased title (matching the style: "How Large Language Models Work", "Budgeting for AI: Understanding Token Costs", "Bias and Fairness in AI Systems")
   - A 300-500 word original lesson for a ${role}. Assume no technical background beyond software delivery. End with one practical takeaway.
3. If the topic is not related to AI, technology leadership, delivery management, or professional skill-building, politely decline and suggest a related topic instead — still return a valid module with the suggestion as the lesson.
4. Fix any typos or unclear phrasing in the title. Never use the user's raw text as the title.

Return ONLY valid JSON array (no other text):
[{"title": "Clean Title Here", "lesson": "Full 300-500 word lesson text here..."}]`

  try {
    const client = await getAnthropicClient()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array in response')

    const parsed: GeneratedModule[] = JSON.parse(match[0])
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty result')

    return parsed.slice(0, 4)
  } catch (err) {
    console.error('[requestTopic] Anthropic generation failed:', err)
    const cleanTitle = rawInput.charAt(0).toUpperCase() + rawInput.slice(1).replace(/\s+/g, ' ').trim()
    return [{
      title: cleanTitle.length > 60 ? cleanTitle.slice(0, 57) + '...' : cleanTitle,
      lesson: `[Pending AI generation] Topic requested: ${rawInput}. Content will be generated when the AI service is available.`
    }]
  }
}

function res(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
