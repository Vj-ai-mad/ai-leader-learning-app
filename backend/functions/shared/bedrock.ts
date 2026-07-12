import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'

export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION ?? 'us-east-1'
})
