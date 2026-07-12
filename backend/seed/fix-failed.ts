/**
 * Fix script: re-generates aiSummary for content items that have the failure placeholder.
 * Usage: npx ts-node seed/fix-failed.ts
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'
const BEDROCK_REGION = process.env.BEDROCK_REGION ?? 'us-east-1'
const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }))
const bedrock = new BedrockRuntimeClient({ region: BEDROCK_REGION })

async function fix() {
  // Find all items with failed content
  const result = await ddb.send(new ScanCommand({ TableName: CONTENT_TABLE }))
  const items = result.Items ?? []

  const failed = items.filter(i =>
    (i.aiSummary as string)?.includes('[Content generation failed')
  )

  console.log(`Found ${failed.length} items with failed content. Fixing...`)

  for (const item of failed) {
    const isLink = item.url && !item.url.startsWith('#')
    let prompt: string

    if (isLink) {
      prompt = `Write a short 100-150 word original framing introduction for the resource "${item.title}" (URL: ${item.url}). Connect it to a delivery leader's daily context — why this matters for someone managing teams and programs. Do not summarize the source itself; instead orient the reader toward what they will learn and how it connects to their role as a PM, Delivery Manager, Platform Lead, or RTE.`
    } else {
      prompt = `Write an original lesson of 300-500 words for a Program Manager/Delivery Manager/Platform Lead/RTE on the topic "${item.title}". Assume no technical background beyond general software delivery experience. End with one practical takeaway they can apply this week. Do not reference or summarize any specific external article — this should be original instructional content.`
    }

    console.log(`  Fixing: ${item.contentId} - ${item.title}`)

    try {
      const response = await bedrock.send(new InvokeModelCommand({
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

      await ddb.send(new UpdateCommand({
        TableName: CONTENT_TABLE,
        Key: { contentId: item.contentId },
        UpdateExpression: 'SET aiSummary = :s',
        ExpressionAttributeValues: { ':s': aiSummary }
      }))

      console.log(`  ✓ Fixed ${item.contentId}`)
    } catch (err) {
      console.error(`  ✗ Still failing for ${item.contentId}:`, (err as Error).message)
    }

    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\nDone! Note: existing plans still have old text.')
  console.log('To fix the active plan, reset the user and re-trigger onboarding.')
}

fix().catch(console.error)
