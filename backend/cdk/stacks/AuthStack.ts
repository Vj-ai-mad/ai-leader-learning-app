import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import * as path from 'path'

interface AuthStackProps extends cdk.StackProps {
  allowListTable: dynamodb.Table
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props)

    // ── Pre Sign-up Lambda ─────────────────────────────────────────────────
    const preSignUpFn = new lambda.Function(this, 'PreSignUpFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'preSignUp.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../functions/auth')
      ),
      environment: {
        ALLOWLIST_TABLE: props.allowListTable.tableName
      }
    })
    props.allowListTable.grantReadData(preSignUpFn)

    // ── User Pool ──────────────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'ai-leader-user-pool',
      selfSignUpEnabled: true,
      signInAliases: { email: true, phone: true },
      autoVerify: { email: true, phone: true },
      standardAttributes: {
        email:       { required: true, mutable: true },
        phoneNumber: { required: true, mutable: true },
        fullname:    { required: true, mutable: true }
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      lambdaTriggers: {
        preSignUp: preSignUpFn
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })

    // ── Admin Group ────────────────────────────────────────────────────────
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
      description: 'Admin users with access to content and allow-list management'
    })

    // ── App Client ─────────────────────────────────────────────────────────
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'ai-leader-web-client',
      generateSecret: false,
      authFlows: {
        custom: true,
        userSrp: true
      },
      accessTokenValidity:  cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      idTokenValidity:      cdk.Duration.hours(1)
    })

    // ── Outputs ────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId',       { value: this.userPool.userPoolId })
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId })
  }
}
