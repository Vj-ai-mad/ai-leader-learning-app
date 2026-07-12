import { ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'
import { sendWhatsAppTemplate } from '../shared/whatsapp'

const USERS_TABLE = process.env.USERS_TABLE ?? 'ai-leader-users'
const PLANS_TABLE = process.env.PLANS_TABLE ?? 'ai-leader-plans'

export async function handler() {
  console.log('[sendWeeklyRecap] Starting weekly recap dispatch')

  const usersResult = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: 'planStatus = :active AND (attribute_not_exists(notifOptOut) OR notifOptOut = :false)',
    ExpressionAttributeValues: { ':active': 'active', ':false': false }
  }))

  const users = usersResult.Items ?? []
  console.log(`[sendWeeklyRecap] Found ${users.length} active users`)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const user of users) {
    try {
      if (!user.planId || !user.phone) continue

      const planResult = await docClient.send(new GetCommand({
        TableName: PLANS_TABLE,
        Key: { planId: user.planId }
      }))
      const plan = planResult.Item
      if (!plan?.days) continue

      const days = plan.days as Array<{ completedAt: string | null; dayIndex: number }>

      // Count completions in last 7 days
      const completedThisWeek = days.filter(
        d => d.completedAt && d.completedAt >= sevenDaysAgo
      ).length

      // Get next 5 upcoming module titles
      const currentIdx = user.currentDayIndex ?? 0
      const upcoming = days
        .slice(currentIdx, currentIdx + 5)
        .map((d, i) => `Day ${currentIdx + i + 1}`)
        .join(', ')

      const streakCount = user.streakCount ?? 0

      const success = await sendWhatsAppTemplate(
        user.phone,
        'weekly_recap',
        [
          user.name ?? 'there',
          String(completedThisWeek),
          String(streakCount),
          upcoming || 'Plan complete!'
        ]
      )

      if (success) {
        console.log(`[sendWeeklyRecap] Sent to ${user.userId}`)
      } else {
        console.error(`[sendWeeklyRecap] Failed for ${user.userId}`)
      }
    } catch (err) {
      console.error(`[sendWeeklyRecap] Error processing ${user.userId}:`, err)
    }
  }

  console.log('[sendWeeklyRecap] Done')
}
