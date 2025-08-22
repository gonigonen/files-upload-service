#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FileManagerStack } from '../lib/file-manager-stack';

const app = new cdk.App();
new FileManagerStack(app, 'FileManagerStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
