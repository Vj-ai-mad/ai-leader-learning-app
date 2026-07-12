import * as cdk from 'aws-cdk-lib'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigwv2Int from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as apigwv2Auth from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import * as path from 'path'

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
  usersTable: dynamodb.Table
  plansTable: dynamodb.Table
  contentTable: dynamodb.Table
  allowListTable: dynamodb.Table
  deepLinkTokensTable: dynamodb.Table
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const functionsRoot = path.join(__dirname, '../../functions')

    // Common environment variables for all Lambdas
    const commonEnv: Record<string, string> = {
      USERS_TABLE: props.usersTable.tableName,
      PLANS_TABLE: props.plansTable.tableName,
      CONTENT_TABLE: props.contentTable.tableName,
      ALLOWLIST_TABLE: props.allowListTable.tableName,
      DEEPLINK_TOKENS_TABLE: props.deepLinkTokensTable.tableName,
      BEDROCK_REGION: 'us-east-1',
      BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      APP_BASE_URL: 'https://REPLACE_AFTER_DEPLOY',
      DEEPLINK_JWT_SECRET: 'REPLACE_WITH_SECRET'
    }

    // ── HTTP API ───────────────────────────────────────────────────────────
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'ai-leader-api',
      corsPreflight: {
        allowOrigins: ['*'], // Tighten to APP_BASE_URL after deploy
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS
        ],
        allowHeaders: ['Authorization', 'Content-Type']
      }
    })

    // ── JWT Authorizer ─────────────────────────────────────────────────────
    const jwtAuth = new apigwv2Auth.HttpJwtAuthorizer(
      'CognitoAuth',
      `https://cognito-idp.ap-south-1.amazonaws.com/${props.userPool.userPoolId}`,
      { jwtAudience: [props.userPoolClient.userPoolClientId] }
    )
    // ── Lambda: Auth (unauthenticated) ──────────────────────────────────────
    const checkAllowListFn = new lambda.Function(this, 'CheckAllowListFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'preSignUp.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'auth')),
      environment: commonEnv
    })
    props.allowListTable.grantReadData(checkAllowListFn)

    const deepLinkExchangeFn = new lambda.Function(this, 'DeepLinkExchangeFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'deepLinkExchange.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'auth')),
      environment: commonEnv
    })
    props.deepLinkTokensTable.grantReadWriteData(deepLinkExchangeFn)
    props.usersTable.grantReadData(deepLinkExchangeFn)
    deepLinkExchangeFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminInitiateAuth'],
      resources: [props.userPool.userPoolArn]
    }))

    // ── Lambda: Onboarding ─────────────────────────────────────────────────
    const submitOnboardingFn = new lambda.Function(this, 'SubmitOnboardingFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'submitOnboarding.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'onboarding')),
      environment: commonEnv
    })
    props.usersTable.grantReadWriteData(submitOnboardingFn)

    // ── Lambda: Plan Generation ────────────────────────────────────────────
    const generatePlanFn = new lambda.Function(this, 'GeneratePlanFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'generatePlan.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'plan')),
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: commonEnv
    })
    props.usersTable.grantReadWriteData(generatePlanFn)
    props.plansTable.grantReadWriteData(generatePlanFn)
    props.contentTable.grantReadData(generatePlanFn)
    generatePlanFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*']
    }))
    submitOnboardingFn.addEnvironment('GENERATE_PLAN_FN', generatePlanFn.functionName)
    generatePlanFn.grantInvoke(submitOnboardingFn)

    // ── Lambda: Module ─────────────────────────────────────────────────────
    const getModuleFn = new lambda.Function(this, 'GetModuleFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getModule.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'module')),
      environment: commonEnv
    })
    props.usersTable.grantReadData(getModuleFn)
    props.plansTable.grantReadData(getModuleFn)
    props.contentTable.grantReadData(getModuleFn)

    const completeModuleFn = new lambda.Function(this, 'CompleteModuleFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'completeModule.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'module')),
      environment: commonEnv
    })
    props.usersTable.grantReadWriteData(completeModuleFn)
    props.plansTable.grantReadWriteData(completeModuleFn)
    // ── Lambda: Progress ───────────────────────────────────────────────────
    const getProgressFn = new lambda.Function(this, 'GetProgressFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getProgress.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'progress')),
      environment: commonEnv
    })
    props.usersTable.grantReadData(getProgressFn)
    props.plansTable.grantReadData(getProgressFn)

    const setPauseStateFn = new lambda.Function(this, 'SetPauseStateFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'setPauseState.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'progress')),
      environment: commonEnv
    })
    props.usersTable.grantReadWriteData(setPauseStateFn)

    // ── Lambda: Admin ──────────────────────────────────────────────────────
    const upsertContentFn = new lambda.Function(this, 'UpsertContentFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'upsertContent.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'admin')),
      environment: commonEnv
    })
    props.contentTable.grantReadWriteData(upsertContentFn)

    const generateSummaryFn = new lambda.Function(this, 'GenerateSummaryFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'generateSummary.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'admin')),
      environment: commonEnv
    })
    props.contentTable.grantReadData(generateSummaryFn)
    generateSummaryFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*']
    }))

    const updateAllowListFn = new lambda.Function(this, 'UpdateAllowListFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'updateAllowList.handler',
      code: lambda.Code.fromAsset(path.join(functionsRoot, 'admin')),
      environment: commonEnv
    })
    props.allowListTable.grantReadWriteData(updateAllowListFn)

    // ── Routes: Unauthenticated ────────────────────────────────────────────
    httpApi.addRoutes({ path: '/auth/check-allowlist', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('CheckAllowList', checkAllowListFn) })
    httpApi.addRoutes({ path: '/auth/deeplink/exchange', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('DeepLinkExchange', deepLinkExchangeFn) })

    // ── Routes: Authenticated ──────────────────────────────────────────────
    httpApi.addRoutes({ path: '/onboarding', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('SubmitOnboarding', submitOnboardingFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/plan/status', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('PlanStatus', generatePlanFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/module/today', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('GetModuleToday', getModuleFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/module/{dayIndex}', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('GetModule', getModuleFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/module/{dayIndex}/complete', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('CompleteModule', completeModuleFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/progress', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('GetProgress', getProgressFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/progress/pause', methods: [apigwv2.HttpMethod.PATCH], integration: new apigwv2Int.HttpLambdaIntegration('SetPause', setPauseStateFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/profile', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('GetProfile', getProgressFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/profile/notifications', methods: [apigwv2.HttpMethod.PATCH], integration: new apigwv2Int.HttpLambdaIntegration('SetNotif', setPauseStateFn), authorizer: jwtAuth })

    // ── Routes: Admin ──────────────────────────────────────────────────────
    httpApi.addRoutes({ path: '/admin/content', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('AdminListContent', upsertContentFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/content/{contentId}', methods: [apigwv2.HttpMethod.PUT], integration: new apigwv2Int.HttpLambdaIntegration('AdminUpsertContent', upsertContentFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/content/{contentId}/summarise', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('AdminSummarise', generateSummaryFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/allowlist', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('AdminAllowList', updateAllowListFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/allowlist/{value}', methods: [apigwv2.HttpMethod.DELETE], integration: new apigwv2Int.HttpLambdaIntegration('AdminDeleteAllow', updateAllowListFn), authorizer: jwtAuth })

    // ── Output ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiEndpoint', { value: httpApi.apiEndpoint })
  }
}
