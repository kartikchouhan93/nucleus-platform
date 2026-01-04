#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
// import { CdkStack } from '../lib/cdkStack';
// import { WebUIStack } from '../lib/webUIStack';
import { NetworkingStack } from '../lib/networkingStack';
import { ComputeStack } from '../lib/computeStack';

const app = new cdk.App();

// Read configuration from context
const appName = app.node.tryGetContext('appName');
const awsAccountId = app.node.tryGetContext('awsAccountId');
const awsRegion = app.node.tryGetContext('awsRegion');

if (!appName || !awsAccountId || !awsRegion) {
  throw new Error('App Name, AWS Account ID and Region must be specified in cdk.context.json');
}

console.log(`Deploying to App: ${appName}, Account: ${awsAccountId}, Region: ${awsRegion}`);

// ============================================================================
// EXISTING STACKS (retained for backward compatibility)
// ============================================================================

// const costEfficientSchedulerStack = new CdkStack(app, `${appName}-CostEfficientSchedulerStack`, {
//   env: { account: awsAccountId, region: awsRegion },
// });

// new WebUIStack(app, `${appName}-WebUIStack`, {
//   env: { account: awsAccountId, region: awsRegion },
//   schedulerLambdaArn: costEfficientSchedulerStack.schedulerLambdaFunctionArn,
// });

// ============================================================================
// NEW STACKS (Networking + Compute with ECS)
// ============================================================================

const networkingStack = new NetworkingStack(app, `${appName}-NetworkingStack`, {
  env: { account: awsAccountId, region: awsRegion },
});

new ComputeStack(app, `${appName}-ComputeStack`, {
  env: { account: awsAccountId, region: awsRegion },
  vpc: networkingStack.vpc,
});