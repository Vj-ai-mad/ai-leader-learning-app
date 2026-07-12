import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const secretsClient = new SecretsManagerClient({})

let cachedToken: { accessToken: string; phoneNumberId: string } | null = null

async function getWhatsAppCredentials() {
  if (cachedToken) return cachedToken

  const secretName = process.env.WHATSAPP_SECRET_NAME ?? 'whatsapp/system-user-token'
  const result = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  )
  cachedToken = JSON.parse(result.SecretString ?? '{}')
  return cachedToken!
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  parameters: string[]
): Promise<boolean> {
  const creds = await getWhatsAppCredentials()

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: parameters.map((p) => ({ type: 'text', text: p }))
        }
      ]
    }
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${creds.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  )

  if (!res.ok) {
    const errorBody = await res.text()
    console.error('[whatsapp] Send failed:', res.status, errorBody)
    return false
  }

  return true
}
