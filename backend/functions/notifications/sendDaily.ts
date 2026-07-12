import { ScanCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'
import { sendWhatsAppTemplate } from '../shared/whatsapp'
import { randomUUID } from 'crypto'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'
const DEEPLINK_TOKENS_TABLE = process.env.DEEPLINK_TOKENS_TABLE ?? 'ai-leader-deeplink-tokens'
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://REPLACE_AFTER_DEPLOY'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function handler() {
  console.log('[sendDaily] Starting daily notification dispatch')

  // Scan for active, opted-in users
  const usersResult = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: 'planStatus = :active AND (attribute_not_exists(notifOptOut) OR notifOptOut = :false)',
    ExpressionAttributeValues: { ':active': 'active', ':false': false }
  }))

  const users = usersResult.Items ?? []
  console.log(`[sendDaily] Found ${users.length} active users`)

  const todayDay = DAYS_OF_WEEK[new Date().getDay()]

  for (const user of users) {
    try {
      // Check if today is in user's activeDays
      const activeDays: string[] = user.activeDays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      if (!activeDays.includes(todayDay)) {
        console.log(`[sendDaily] Skipping ${user.userId} — ${todayDay} not in activeDays`)
        continue
      }

      if (!user.planId || !user.phone) continue

      // Get today's module from plan
      const planResult = await docClient.send(new GetCommand({
        TableName: PLANS_TABLE,
        Key: { planId: user.planId }
      }))
      const plan = planResult.Item
      if (!plan?.days) continue

      const dayIndex = user.currentDayIndex ?? 0
      const dayEntry = plan.days[dayIndex]
      if (!dayEntry) continue

      // Mint a deep-link token
      const token = randomUUID()
      const expiresAt = Math.floor(Date.now() / 1000) + 86400 // 24 hours

      await docClient.send(new PutCommand({
        TableName: DEEPLINK_TOKENS_TABLE,
        Item: { token, userId: user.userId, dayIndex, expiresAt, used: false }
      }))

      const deepLinkUrl = `${APP_BASE_URL}/deeplink?token=${token}`
      const moduleTitle = dayEntry.title ?? `Day ${dayIndex + 1} module`

      // Send WhatsApp message
      const success = await sendWhatsAppTemplate(
        user.phone,
        'daily_module_reminder',
        [user.name ?? 'there', moduleTitle, deepLinkUrl]
      )

      if (success) {
        console.log(`[sendDaily] Sent to ${user.userId}`)
      } else {
        console.error(`[sendDaily] Failed for ${user.userId}`)
      }
    } catch (err) {
      console.error(`[sendDaily] Error processing ${user.userId}:`, err)
    }
  }

  console.log('[sendDaily] Done')
}
