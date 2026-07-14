/**
 * Seeds role-specific modules for new roles.
 * Usage: ANTHROPIC_API_KEY=sk-... npx ts-node seed/seed-role-specific.ts
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import Anthropic from '@anthropic-ai/sdk'

const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }))
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const MODEL = 'claude-haiku-4-5-20251001'

interface NewModule {
  id: string
  title: string
  stage: number
  roleRelevance: string[]
  tags: string[]
}

const NEW_MODULES: NewModule[] = [
  // Test Manager / QA Manager — Stage 2
  { id: 'mod-47', title: 'AI-Assisted Test Case Generation and Coverage Analysis', stage: 2, roleRelevance: ['Test Manager / QA Manager', 'General'], tags: ['testing', 'AI', 'coverage', 'test generation'] },
  { id: 'mod-48', title: 'Evaluating AI Testing Tools for Your QA Practice', stage: 2, roleRelevance: ['Test Manager / QA Manager', 'General'], tags: ['tools', 'evaluation', 'QA', 'testing'] },
  { id: 'mod-49', title: 'Quality Risk When AI Writes or Reviews Code', stage: 4, roleRelevance: ['Test Manager / QA Manager', 'General'], tags: ['quality', 'risk', 'code review', 'AI-generated code'] },

  // Production Manager — Stage 2
  { id: 'mod-50', title: 'AI in Production Monitoring and Anomaly Detection', stage: 2, roleRelevance: ['Production Manager', 'SRE', 'General'], tags: ['production', 'monitoring', 'anomaly detection'] },
  { id: 'mod-51', title: 'Managing AI-Driven Change in Production Environments', stage: 4, roleRelevance: ['Production Manager', 'General'], tags: ['production', 'change management', 'risk'] },

  // Service Delivery Manager — Stage 4
  { id: 'mod-52', title: 'AI Clauses in Vendor Contracts and SLAs', stage: 4, roleRelevance: ['Service Delivery Manager (SDM)', 'General'], tags: ['contracts', 'SLA', 'vendor', 'legal'] },
  { id: 'mod-53', title: 'Managing AI-Related Service Credits and Risk in Outsourced Delivery', stage: 4, roleRelevance: ['Service Delivery Manager (SDM)', 'General'], tags: ['outsourcing', 'risk', 'service credits'] },

  // DevOps / SRE — Stage 2
  { id: 'mod-54', title: 'AI in Observability and Incident Triage', stage: 2, roleRelevance: ['DevOps Engineer', 'SRE', 'General'], tags: ['observability', 'incidents', 'triage', 'DevOps'] },
  { id: 'mod-55', title: 'AI-Assisted Root-Cause Analysis', stage: 2, roleRelevance: ['DevOps Engineer', 'SRE', 'General'], tags: ['RCA', 'root cause', 'incident response', 'DevOps'] }
]

async function seed() {
  console.log(`Seeding ${NEW_MODULES.length} role-specific modules...`)
  const now = new Date().toISOString()

  for (const mod of NEW_MODULES) {
    console.log(`  Generating: ${mod.id} - ${mod.title}`)

    const prompt = `Write an original lesson of 300-500 words for a ${mod.roleRelevance[0]} on the topic "${mod.title}". Assume no technical background beyond general software delivery experience. End with one practical takeaway they can apply this week. Do not reference or summarize any specific external article — this should be original instructional content.`

    let aiSummary: string
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
      aiSummary = response.content[0].type === 'text' ? response.content[0].text : ''
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message}`)
      aiSummary = `[Pending] Topic: ${mod.title}`
    }

    await ddb.send(new PutCommand({
      TableName: CONTENT_TABLE,
      Item: {
        contentId: mod.id,
        title: mod.title,
        url: `#original-content-${mod.id}`,
        format: 'article',
        stage: mod.stage,
        roleRelevance: new Set(mod.roleRelevance),
        tags: new Set(mod.tags),
        aiSummary,
        estimatedMinutes: 15,
        active: 'true',
        reviewedByAdmin: false, // Set to true after your review
        createdAt: now,
        updatedAt: now
      }
    }))

    console.log(`  ✓ Saved ${mod.id}`)
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n✅ Role-specific modules seeded!')
  console.log('Set reviewedByAdmin: true after reviewing content.')
}

seed().catch(console.error)
