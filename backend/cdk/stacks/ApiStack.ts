import * as cdk from 'aws-cdk-lib'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigwv2Int from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as apigwv2Auth from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
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

    const commonEnv: Record<string, string> = {
      USERS_TABLE: props.usersTable.tableName,
      PLANS_TABLE: props.plansTable.tableName,
      CONTENT_TABLE: props.contentTable.tableName,
      ALLOWLIST_TABLE: props.allowListTable.tableName,
      DEEPLINK_TOKENS_TABLE: props.deepLinkTokensTable.tableName,
      BEDROCK_REGION: 'us-east-1',
      BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      APP_BASE_URL: 'https://staging.d2kbjleppi9cxx.amplifyapp.com',
      DEEPLINK_JWT_SECRET: 'REPLACE_WITH_SECRET'
    }

    const nodejsProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: commonEnv,
      bundling: { minify: true, sourceMap: true }
    }

    // ── HTTP API ───────────────────────────────────────────────────────────
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'ai-leader-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.PUT, apigwv2.CorsHttpMethod.PATCH, apigwv2.CorsHttpMethod.DELETE, apigwv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Authorization', 'Content-Type']
      }
    })

    const jwtAuth = new apigwv2Auth.HttpJwtAuthorizer('CognitoAuth', `https://cognito-idp.ap-south-1.amazonaws.com/${props.userPool.userPoolId}`, { jwtAudience: [props.userPoolClient.userPoolClientId] })

    // ── Lambdas ────────────────────────────────────────────────────────────
    const checkAllowListFn = new NodejsFunction(this, 'CheckAllowListFn', { ...nodejsProps, entry: path.join(functionsRoot, 'auth/checkAllowList.ts') })
    props.allowListTable.grantReadData(checkAllowListFn)

    const deepLinkExchangeFn = new NodejsFunction(this, 'DeepLinkExchangeFn', { ...nodejsProps, entry: path.join(functionsRoot, 'auth/deepLinkExchange.ts') })
    props.deepLinkTokensTable.grantReadWriteData(deepLinkExchangeFn)
    props.usersTable.grantReadData(deepLinkExchangeFn)
    deepLinkExchangeFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['cognito-idp:AdminInitiateAuth'], resources: [props.userPool.userPoolArn] }))

    const submitOnboardingFn = new NodejsFunction(this, 'SubmitOnboardingFn', { ...nodejsProps, entry: path.join(functionsRoot, 'onboarding/submitOnboarding.ts') })
    props.usersTable.grantReadWriteData(submitOnboardingFn)

    const generatePlanFn = new NodejsFunction(this, 'GeneratePlanFn', { ...nodejsProps, entry: path.join(functionsRoot, 'plan/generatePlan.ts'), timeout: cdk.Duration.minutes(2), memorySize: 512 })
    props.usersTable.grantReadWriteData(generatePlanFn)
    props.plansTable.grantReadWriteData(generatePlanFn)
    props.contentTable.grantReadData(generatePlanFn)
    generatePlanFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: ['*'] }))
    submitOnboardingFn.addEnvironment('GENERATE_PLAN_FN', generatePlanFn.functionName)

    const requestTopicFn = new NodejsFunction(this, 'RequestTopicFn', { ...nodejsProps, entry: path.join(functionsRoot, 'plan/requestTopic.ts'), timeout: cdk.Duration.seconds(30) })
    props.usersTable.grantReadData(requestTopicFn)
    props.plansTable.grantReadWriteData(requestTopicFn)
    props.contentTable.grantReadWriteData(requestTopicFn)
    requestTopicFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: ['*'] }))
    generatePlanFn.grantInvoke(submitOnboardingFn)

    const getModuleFn = new NodejsFunction(this, 'GetModuleFn', { ...nodejsProps, entry: path.join(functionsRoot, 'module/getModule.ts') })
    props.usersTable.grantReadData(getModuleFn)
    props.plansTable.grantReadData(getModuleFn)
    props.contentTable.grantReadData(getModuleFn)

    const completeModuleFn = new NodejsFunction(this, 'CompleteModuleFn', { ...nodejsProps, entry: path.join(functionsRoot, 'module/completeModule.ts') })
    props.usersTable.grantReadWriteData(completeModuleFn)
    props.plansTable.grantReadWriteData(completeModuleFn)

    const getProgressFn = new NodejsFunction(this, 'GetProgressFn', { ...nodejsProps, entry: path.join(functionsRoot, 'progress/getProgress.ts') })
    props.usersTable.grantReadData(getProgressFn)
    props.plansTable.grantReadData(getProgressFn)
    props.contentTable.grantReadData(getProgressFn)

    const setPauseStateFn = new NodejsFunction(this, 'SetPauseStateFn', { ...nodejsProps, entry: path.join(functionsRoot, 'progress/setPauseState.ts') })
    props.usersTable.grantReadWriteData(setPauseStateFn)

    const upsertContentFn = new NodejsFunction(this, 'UpsertContentFn', { ...nodejsProps, entry: path.join(functionsRoot, 'admin/upsertContent.ts') })
    props.contentTable.grantReadWriteData(upsertContentFn)

    const generateSummaryFn = new NodejsFunction(this, 'GenerateSummaryFn', { ...nodejsProps, entry: path.join(functionsRoot, 'admin/generateSummary.ts') })
    props.contentTable.grantReadData(generateSummaryFn)
    generateSummaryFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: ['*'] }))

    const updateAllowListFn = new NodejsFunction(this, 'UpdateAllowListFn', { ...nodejsProps, entry: path.join(functionsRoot, 'admin/updateAllowList.ts') })
    props.allowListTable.grantReadWriteData(updateAllowListFn)

    // ── Routes ─────────────────────────────────────────────────────────────
    httpApi.addRoutes({ path: '/auth/check-allowlist', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('CheckAllowList', checkAllowListFn) })
    httpApi.addRoutes({ path: '/auth/deeplink/exchange', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('DeepLinkExchange', deepLinkExchangeFn) })
    httpApi.addRoutes({ path: '/onboarding', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('SubmitOnboarding', submitOnboardingFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/plan/status', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('PlanStatus', generatePlanFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/plan/request-topic', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('RequestTopic', requestTopicFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/module/today', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('GetModuleToday', getModuleFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/module/{dayIndex}', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('GetModule', getModuleFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/module/{dayIndex}/complete', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('CompleteModule', completeModuleFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/progress', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('GetProgress', getProgressFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/progress/pause', methods: [apigwv2.HttpMethod.PATCH], integration: new apigwv2Int.HttpLambdaIntegration('SetPause', setPauseStateFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/profile', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('GetProfile', getProgressFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/profile/notifications', methods: [apigwv2.HttpMethod.PATCH], integration: new apigwv2Int.HttpLambdaIntegration('SetNotif', setPauseStateFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/content', methods: [apigwv2.HttpMethod.GET], integration: new apigwv2Int.HttpLambdaIntegration('AdminListContent', upsertContentFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/content/{contentId}', methods: [apigwv2.HttpMethod.PUT], integration: new apigwv2Int.HttpLambdaIntegration('AdminUpsertContent', upsertContentFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/content/{contentId}/summarise', methods: [apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('AdminSummarise', generateSummaryFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/allowlist', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration: new apigwv2Int.HttpLambdaIntegration('AdminAllowList', updateAllowListFn), authorizer: jwtAuth })
    httpApi.addRoutes({ path: '/admin/allowlist/{value}', methods: [apigwv2.HttpMethod.DELETE], integration: new apigwv2Int.HttpLambdaIntegration('AdminDeleteAllow', updateAllowListFn), authorizer: jwtAuth })

    new cdk.CfnOutput(this, 'ApiEndpoint', { value: httpApi.apiEndpoint })
  }
}
