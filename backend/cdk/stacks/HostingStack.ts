import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
// TODO T13: Configure Amplify Hosting in Phase 1

export class HostingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)
    // Stub — Amplify Hosting configured via AWS Console for tester phase
    // CDK Amplify Hosting construct can be added here later if desired
  }
}
