/**
 * Seed script: populates the Content DynamoDB table with all 46 modules.
 * For "Original" modules, calls Bedrock to generate a 300-500 word lesson.
 * For "Link" modules, calls Bedrock to generate a 100-150 word framing intro.
 *
 * Usage: npx ts-node seed/seed-content.ts
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const CONTENT_TABLE = process.env.CONTENT_TABLE ?? 'ai-leader-content'
const BEDROCK_REGION = process.env.BEDROCK_REGION ?? 'us-east-1'
const MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514-v1:0'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }))
const bedrock = new BedrockRuntimeClient({ region: BEDROCK_REGION })

interface Module {
  id: string
  title: string
  stage: number
  format: string
  estimatedMinutes: number
  type: 'Original' | 'Link'
  url: string
  roleRelevance: string[]
  tags: string[]
  note?: string
}

const MODULES: Module[] = [
  // Stage 1
  {id:"mod-01",title:"What Is Artificial Intelligence, Really?",stage:1,format:"article",estimatedMinutes:15,type:"Link",url:"https://www.ibm.com/think/topics/artificial-intelligence",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["AI basics","definition"]},
  {id:"mod-02",title:"How Large Language Models Work (No Math Required)",stage:1,format:"article",estimatedMinutes:20,type:"Link",url:"https://www.understandingai.org/p/large-language-models-explained-with",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["LLM","language models"]},
  {id:"mod-03",title:"Tokens, Context Windows, and Prompts Explained",stage:1,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["tokens","context window","prompts"]},
  {id:"mod-04",title:"The AI Glossary Every Leader Should Know",stage:1,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["glossary","terminology"]},
  {id:"mod-05",title:"What AI Can (and Can't) Do Reliably",stage:1,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["capabilities","limitations"]},
  {id:"mod-06",title:"Hallucinations: Why AI Sometimes Gets It Wrong",stage:1,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["hallucinations","accuracy","risk"]},
  {id:"mod-07",title:"Generative AI vs. Traditional Software",stage:1,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["generative AI","comparison"]},
  {id:"mod-08",title:"AI Agents and Autonomous Systems, Explained Simply",stage:1,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["AI agents","autonomous"]},
  {id:"mod-09",title:"A Brief History of the Current AI Wave",stage:1,format:"article",estimatedMinutes:15,type:"Link",url:"https://ourworldindata.org/brief-history-of-ai",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["history","timeline"]},
  // Stage 2
  {id:"mod-10",title:"Where AI Actually Fits in the SDLC",stage:2,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["SDLC","integration"]},
  {id:"mod-11",title:"AI-Assisted Estimation and Backlog Grooming",stage:2,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["estimation","backlog","planning"]},
  {id:"mod-12",title:"AI in Test Automation and QA",stage:2,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","General"],tags:["testing","QA","automation"]},
  {id:"mod-13",title:"AI Code Review and Pair-Programming Tools",stage:2,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["Platform Lead","Delivery Manager","General"],tags:["code review","pair programming","tools"]},
  {id:"mod-14",title:"How AI Changes Velocity and Planning Assumptions",stage:2,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["velocity","planning","metrics"]},
  {id:"mod-15",title:"Using AI for Incident and Run Support",stage:2,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["Platform Lead","Delivery Manager","General"],tags:["incident","operations","support"]},
  {id:"mod-16",title:"Measuring AI's Real Impact on Delivery Metrics",stage:2,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["metrics","measurement","ROI"]},
  {id:"mod-17",title:"Common Pitfalls When Introducing AI Tools to a Team",stage:2,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["pitfalls","adoption","team"]},
  {id:"mod-18",title:"Case Study: Running an AI-Enabled Sprint",stage:2,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["case study","sprint","agile"]},
  // Stage 3
  {id:"mod-19",title:"Scoping an AI Feature: What to Ask Your Engineering Team",stage:3,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","General"],tags:["scoping","requirements","engineering"]},
  {id:"mod-20",title:"Setting Realistic Timelines for AI Projects",stage:3,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["timelines","estimation","planning"]},
  {id:"mod-21",title:"Build vs. Buy: Evaluating AI Vendors and Tools",stage:3,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Platform Lead","Delivery Manager","General"],tags:["build vs buy","vendors","evaluation"]},
  {id:"mod-22",title:"Writing an AI Epic: A Practical Template",stage:3,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["epic","template","agile"]},
  {id:"mod-23",title:"Stakeholder Communication for AI Initiatives",stage:3,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["stakeholder","communication","leadership"]},
  {id:"mod-24",title:"Budgeting for AI: Understanding Token Costs",stage:3,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Platform Lead","Delivery Manager","General"],tags:["budget","costs","tokens"]},
  {id:"mod-25",title:"Change Management for AI-Driven Process Shifts",stage:3,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["change management","process","adoption"]},
  {id:"mod-26",title:"Working With Data Teams on AI Readiness",stage:3,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["Platform Lead","Delivery Manager","PM","General"],tags:["data","readiness","collaboration"]},
  {id:"mod-27",title:"Case Study: Launching an AI Feature End to End",stage:3,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["case study","launch","end to end"]},
  // Stage 4
  {id:"mod-28",title:"Introduction to Model Risk Management",stage:4,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["model risk","risk management","governance"]},
  {id:"mod-29",title:"Data Privacy Considerations for AI Systems",stage:4,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","General"],tags:["privacy","data","GDPR","compliance"]},
  {id:"mod-30",title:"Third-Party AI Vendor Risk Assessment",stage:4,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Platform Lead","Delivery Manager","General"],tags:["vendor risk","third party","assessment"]},
  {id:"mod-31",title:"Responsible AI Principles for Delivery Leaders",stage:4,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["responsible AI","principles","ethics"]},
  {id:"mod-32",title:"Auditing and Compliance Basics for AI",stage:4,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","General"],tags:["auditing","compliance","regulation"]},
  {id:"mod-33",title:"Incident Response When AI Goes Wrong in Production",stage:4,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["Platform Lead","Delivery Manager","RTE","General"],tags:["incident response","production","recovery"]},
  {id:"mod-34",title:"Bias and Fairness in AI Systems",stage:4,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["bias","fairness","ethics"]},
  {id:"mod-35",title:"The Regulatory Landscape: India and Global Overview",stage:4,format:"article",estimatedMinutes:20,type:"Link",url:"https://www.morganlewis.com/topics/artificial-intelligence",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["regulation","India","global","legal"],note:"NOTE: Re-verify this regulatory link closer to tester launch — AI regulation changes monthly"},
  {id:"mod-36",title:"Explainability and Documentation Requirements",stage:4,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","General"],tags:["explainability","documentation","XAI"]},
  {id:"mod-37",title:"Case Study: Designing an AI Governance Framework",stage:4,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["case study","governance","framework"]},
  // Stage 5
  {id:"mod-38",title:"How to Run an AI Steering Conversation",stage:5,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["steering","leadership","conversation"]},
  {id:"mod-39",title:"Communicating AI Value (and Risk) to Executives",stage:5,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["executive","communication","value"]},
  {id:"mod-40",title:"Staying Current as AI Keeps Evolving",stage:5,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["staying current","learning","evolution"]},
  {id:"mod-41",title:"Building an AI-Curious Culture in Your Team",stage:5,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["culture","curiosity","team"]},
  {id:"mod-42",title:"Common Objections to AI Adoption — and How to Answer Them",stage:5,format:"article",estimatedMinutes:15,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","RTE","General"],tags:["objections","adoption","persuasion"]},
  {id:"mod-43",title:"Your First 90 Days Leading AI Initiatives",stage:5,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["90 days","leadership","onboarding"]},
  {id:"mod-44",title:"Communities and Networks for AI-Fluent Leaders",stage:5,format:"article",estimatedMinutes:10,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["communities","networking","resources"]},
  {id:"mod-45",title:"Putting It All Together: Your Personal AI Roadmap",stage:5,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["roadmap","personal plan","synthesis"]},
  {id:"mod-46",title:"Final Case Study: A Delivery Leader's AI Journey",stage:5,format:"article",estimatedMinutes:20,type:"Original",url:"",roleRelevance:["PM","Delivery Manager","Platform Lead","RTE","General"],tags:["case study","journey","capstone"]}
]

async function generateContent(mod: Module): Promise<string> {
  let prompt: string

  if (mod.type === 'Original') {
    prompt = `Write an original lesson of 300-500 words for a Program Manager/Delivery Manager/Platform Lead/RTE on the topic "${mod.title}". Assume no technical background beyond general software delivery experience. End with one practical takeaway they can apply this week. Do not reference or summarize any specific external article — this should be original instructional content.`
  } else {
    prompt = `Write a short 100-150 word original framing introduction for the resource "${mod.title}" (URL: ${mod.url}). Connect it to a delivery leader's daily context — why this matters for someone managing teams and programs. Do not summarize the source itself; instead orient the reader toward what they will learn and how it connects to their role as a PM, Delivery Manager, Platform Lead, or RTE.`
  }

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
  return body.content?.[0]?.text ?? ''
}

async function seedAll() {
  console.log(`Seeding ${MODULES.length} content items...`)
  const now = new Date().toISOString()

  for (let i = 0; i < MODULES.length; i++) {
    const mod = MODULES[i]
    console.log(`[${i + 1}/${MODULES.length}] Generating: ${mod.title}`)

    let aiSummary: string
    try {
      aiSummary = await generateContent(mod)
    } catch (err) {
      console.error(`  ERROR generating content for ${mod.id}:`, err)
      aiSummary = `[Content generation failed — manually populate later] Topic: ${mod.title}`
    }

    const item = {
      contentId: mod.id,
      title: mod.title,
      url: mod.url || `#original-content-${mod.id}`,
      format: mod.format,
      stage: mod.stage,
      roleRelevance: new Set(mod.roleRelevance),
      tags: new Set(mod.tags),
      aiSummary,
      estimatedMinutes: mod.estimatedMinutes,
      active: 'true',
      reviewedByAdmin: true,
      createdAt: now,
      updatedAt: now,
      ...(mod.note ? { note: mod.note } : {})
    }

    await ddb.send(new PutCommand({ TableName: CONTENT_TABLE, Item: item }))
    console.log(`  ✓ Saved ${mod.id}`)

    // Small delay to avoid Bedrock throttling
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n✅ Seeding complete!')
}

seedAll().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

