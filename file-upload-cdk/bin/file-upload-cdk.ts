#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FileUploadStack } from '../lib/file-upload-stack';

const app = new cdk.App();
new FileUploadStack(app, 'FileUploadStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
