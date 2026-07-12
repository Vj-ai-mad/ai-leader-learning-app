import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export class DatabaseStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table
  public readonly plansTable: dynamodb.Table
  public readonly contentTable: dynamodb.Table
  public readonly allowListTable: dynamodb.Table
  public readonly deepLinkTokensTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // ── Users ──────────────────────────────────────────────────────────────
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'ai-leader-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    })
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'PhoneIndex',
      partitionKey: { name: 'phone', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    })

    // ── Plans ──────────────────────────────────────────────────────────────
    this.plansTable = new dynamodb.Table(this, 'PlansTable', {
      tableName: 'ai-leader-plans',
      partitionKey: { name: 'planId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })
    this.plansTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'generatedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    })

    // ── Content ────────────────────────────────────────────────────────────
    this.contentTable = new dynamodb.Table(this, 'ContentTable', {
      tableName: 'ai-leader-content',
      partitionKey: { name: 'contentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })
    this.contentTable.addGlobalSecondaryIndex({
      indexName: 'StageActiveIndex',
      partitionKey: { name: 'stage', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'active', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    })

    // ── AllowList ──────────────────────────────────────────────────────────
    this.allowListTable = new dynamodb.Table(this, 'AllowListTable', {
      tableName: 'ai-leader-allowlist',
      partitionKey: { name: 'value', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })

    // ── DeepLinkTokens ─────────────────────────────────────────────────────
    this.deepLinkTokensTable = new dynamodb.Table(this, 'DeepLinkTokensTable', {
      tableName: 'ai-leader-deeplink-tokens',
      partitionKey: { name: 'token', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY  // tokens are ephemeral
    })

    // ── Outputs ────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UsersTableName',          { value: this.usersTable.tableName })
    new cdk.CfnOutput(this, 'PlansTableName',          { value: this.plansTable.tableName })
    new cdk.CfnOutput(this, 'ContentTableName',        { value: this.contentTable.tableName })
    new cdk.CfnOutput(this, 'AllowListTableName',      { value: this.allowListTable.tableName })
    new cdk.CfnOutput(this, 'DeepLinkTokensTableName', { value: this.deepLinkTokensTable.tableName })
  }
}
