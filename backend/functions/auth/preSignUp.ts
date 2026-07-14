import type { PreSignUpTriggerEvent } from 'aws-lambda'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamodb'

const ALLOWLIST_TABLE = process.env.ALLOWLIST_TABLE ?? 'ai-leader-allowlist'

export async function handler(event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> {
  const email = event.request.userAttributes.email
  const phone = event.request.userAttributes.phone_number

  // Check if email OR phone is on the allow-list
  const [emailCheck, phoneCheck] = await Promise.all([
    email ? docClient.send(new GetCommand({ TableName: ALLOWLIST_TABLE, Key: { value: email } })) : null,
    phone ? docClient.send(new GetCommand({ TableName: ALLOWLIST_TABLE, Key: { value: phone } })) : null
  ])

  const isAllowed = emailCheck?.Item || phoneCheck?.Item

  if (!isAllowed) {
    throw new Error('NotAuthorizedException: This app is invite-only. Contact Vijay to request access.')
  }

  // Auto-confirm user and verify attributes so they can sign in immediately
  event.response.autoConfirmUser = true
  event.response.autoVerifyEmail = true
  event.response.autoVerifyPhone = true

  return event
}
