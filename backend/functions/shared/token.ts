import * as crypto from 'crypto'

const SECRET = process.env.DEEPLINK_JWT_SECRET ?? 'REPLACE_WITH_REAL_SECRET'
const EXPIRY_SECONDS = 24 * 60 * 60 // 24 hours

interface DeepLinkPayload {
  userId: string
  dayIndex: number
  exp: number
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url')
}

export function signDeepLinkToken(userId: string, dayIndex: number): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload: DeepLinkPayload = {
    userId,
    dayIndex,
    exp: Math.floor(Date.now() / 1000) + EXPIRY_SECONDS
  }
  const payloadEncoded = base64url(Buffer.from(JSON.stringify(payload)))
  const signature = base64url(
    crypto.createHmac('sha256', SECRET).update(`${header}.${payloadEncoded}`).digest()
  )
  return `${header}.${payloadEncoded}.${signature}`
}

export function verifyDeepLinkToken(token: string): DeepLinkPayload {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) throw new Error('Invalid token format')

  const expectedSig = base64url(
    crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest()
  )

  if (signature !== expectedSig) throw new Error('Invalid signature')

  const decoded: DeepLinkPayload = JSON.parse(
    Buffer.from(payload, 'base64url').toString()
  )

  if (decoded.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired')

  return decoded
}
