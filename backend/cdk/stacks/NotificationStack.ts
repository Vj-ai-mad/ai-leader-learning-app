import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as scheduler from 'aws-cdk-lib/aws-scheduler'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import * as path from 'path'

interface NotificationStackProps extends cdk.StackProps {
  usersTable: dynamodb.Table
  plansTable: dynamodb.Table
  deepLinkTokensTable: dynamodb.Table
}

export class NotificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: NotificationStackProps) {
    super(scope, id, props)

    const commonEnv = {
      USERS_TABLE:          props.usersTable.tableName,
      PLANS_TABLE:          props.plansTable.tableName,
      DEEPLINK_TOKENS_TABLE: props.deepLinkTokensTable.tableName,
      APP_BASE_URL:         process.env.APP_BASE_URL ?? 'https://REPLACE_AFTER_DEPLOY',
      WHATSAPP_SECRET_NAME: 'whatsapp/system-user-token'
    }

    // ── sendDaily Lambda ───────────────────────────────────────────────────
    const sendDailyFn = new lambda.Function(this, 'SendDailyFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'sendDaily.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../functions/notifications')
      ),
      timeout: cdk.Duration.minutes(5),
      environment: commonEnv
    })

    props.usersTable.grant(sendDailyFn, 'dynamodb:Scan')
    props.plansTable.grantReadData(sendDailyFn)
    props.deepLinkTokensTable.grantWriteData(sendDailyFn)
    sendDailyFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:ap-south-1:*:secret:whatsapp/system-user-token*`]
    }))

    // ── sendWeeklyRecap Lambda ─────────────────────────────────────────────
    const sendWeeklyFn = new lambda.Function(this, 'SendWeeklyFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'sendWeeklyRecap.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../functions/notifications')
      ),
      timeout: cdk.Duration.minutes(5),
      environment: commonEnv
    })

    props.usersTable.grant(sendWeeklyFn, 'dynamodb:Scan')
    props.plansTable.grantReadData(sendWeeklyFn)
    sendWeeklyFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:ap-south-1:*:secret:whatsapp/system-user-token*`]
    }))

    // ── Scheduler role ─────────────────────────────────────────────────────
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com')
    })
    sendDailyFn.grantInvoke(schedulerRole)
    sendWeeklyFn.grantInvoke(schedulerRole)

    // ── Daily schedule: 02:30 UTC = 08:00 IST ─────────────────────────────
    new scheduler.CfnSchedule(this, 'DailySchedule', {
      scheduleExpression: 'cron(30 2 * * ? *)',
      flexibleTimeWindow: { mode: 'OFF' },
      target: {
        arn: sendDailyFn.functionArn,
        roleArn: schedulerRole.roleArn
      }
    })

    // ── Weekly schedule: 02:30 UTC every Sunday ────────────────────────────
    new scheduler.CfnSchedule(this, 'WeeklySchedule', {
      scheduleExpression: 'cron(30 2 ? * SUN *)',
      flexibleTimeWindow: { mode: 'OFF' },
      target: {
        arn: sendWeeklyFn.functionArn,
        roleArn: schedulerRole.roleArn
      }
    })
  }
}
