#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FileManagerStack } from '../lib/file-manager-stack';

const app = new cdk.App();

// Get environment from context (optional, defaults to 'demo')
const environment = app.node.tryGetContext('environment') || 'demo';

// Use fixed stack name - don't make it configurable
const stackName = 'FileManagerStack';

// Get AWS account and region from environment variables (set by deploy script)
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

console.log(`Deploying File Manager Demo: ${stackName}`);
console.log(`Environment: ${environment}`);
console.log(`Region: ${region}`);
console.log(`Account: ${account || 'default'}`);

new FileManagerStack(app, stackName, {
  env: {
    region: region,
    account: account,
  },
  description: `File Manager Service Demo`,
  tags: {
    Environment: environment,
    Project: 'FileManagerDemo',
    Purpose: 'Showcase',
    ManagedBy: 'CDK',
  },
});
