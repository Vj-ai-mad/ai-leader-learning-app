import Anthropic from '@anthropic-ai/sdk'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const secretsClient = new SecretsManagerClient({})
const SECRET_NAME = process.env.ANTHROPIC_SECRET_NAME ?? 'anthropic/api-key'

let cachedClient: Anthropic | null = null

/**
 * Returns an Anthropic client configured with the API key from Secrets Manager.
 * Caches the client for the Lambda invocation lifetime.
 */
export async function getAnthropicClient(): Promise<Anthropic> {
  if (cachedClient) return cachedClient

  const result = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: SECRET_NAME })
  )

  const secret = JSON.parse(result.SecretString ?? '{}')
  const apiKey = secret.apiKey ?? result.SecretString

  cachedClient = new Anthropic({ apiKey })
  return cachedClient
}

export const MODEL = 'claude-haiku-4-5-20251001'
