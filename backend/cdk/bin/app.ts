#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { AuthStack } from '../stacks/AuthStack'
import { DatabaseStack } from '../stacks/DatabaseStack'
import { ApiStack } from '../stacks/ApiStack'
import { NotificationStack } from '../stacks/NotificationStack'
import { HostingStack } from '../stacks/HostingStack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-south-1'
}

const dbStack = new DatabaseStack(app, 'AiLeaderDatabaseStack', { env })

const authStack = new AuthStack(app, 'AiLeaderAuthStack', {
  env,
  allowListTable: dbStack.allowListTable
})

const apiStack = new ApiStack(app, 'AiLeaderApiStack', {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  usersTable: dbStack.usersTable,
  plansTable: dbStack.plansTable,
  contentTable: dbStack.contentTable,
  allowListTable: dbStack.allowListTable,
  deepLinkTokensTable: dbStack.deepLinkTokensTable
})

new NotificationStack(app, 'AiLeaderNotificationStack', {
  env,
  usersTable: dbStack.usersTable,
  plansTable: dbStack.plansTable,
  deepLinkTokensTable: dbStack.deepLinkTokensTable
})

new HostingStack(app, 'AiLeaderHostingStack', { env })

// Suppress unused variable warnings for stacks not yet consumed
void apiStack
