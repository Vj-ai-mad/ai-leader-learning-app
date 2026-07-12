/**
 * Amplify configuration.
 * Replace placeholder values with real outputs from CDK after first deploy.
 * These are NOT secrets — they are public client identifiers.
 */
const awsExports = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID ?? 'REPLACE_AFTER_DEPLOY',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID ?? 'REPLACE_AFTER_DEPLOY',
      loginWith: {
        email: true,
        phone: true
      }
    }
  },
  API: {
    REST: {
      api: {
        endpoint: import.meta.env.VITE_API_ENDPOINT ?? 'REPLACE_AFTER_DEPLOY',
        region: 'ap-south-1'
      }
    }
  }
}

export default awsExports
