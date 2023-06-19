#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "lib/stacks/api.stack";
import { AuthStack } from "lib/stacks/auth.stack";
import { DbStack } from "lib/stacks/db.stack";
import { SqsStack } from "lib/stacks/sqs.stack";
import { PingsProcessorStack } from "lib/stacks/pings-processor.stack";
import { UIStack } from "lib/stacks/ui.stack";
import { PingsNotifierStack } from "lib/stacks/pings-notifier.stack";

const app = new cdk.App();

const region = process.env.CDK_DEFAULT_REGION!;
const account = process.env.CDK_DEFAULT_ACCOUNT!;

const commonStackProps: cdk.StackProps = {
  /* If you don't specify 'env', app stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */
  /* Uncomment the next line to specialize app stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  env: {
    account,
    region,
  },
  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
};

const db = new DbStack(app, `PingwayDb`, {
  ...commonStackProps,
});
const sqs = new SqsStack(app, `PingwaySqs`, {
  ...commonStackProps,
});

const auth = new AuthStack(app, `PingwayAuth`, {
  region,
  usersTable: db.usersTable,
  ...commonStackProps,
});
auth.addDependency(db);

const pingsNotifier = new PingsNotifierStack(app, "PingwayNotifier", {
  reminderMarkedSentQueue: sqs.reminderMarkedSentQueue,
  pingsTable: db.pingsTable,
  pingRemindersTable: db.pingRemindersTable,
  usersTable: db.usersTable,
  ...commonStackProps,
});
pingsNotifier.addDependency(sqs);
pingsNotifier.addDependency(db);

const pingsProcessor = new PingsProcessorStack(app, `PingwayProcessing`, {
  region,
  storePingsQueue: sqs.addPingsQueue,
  remindersQueue: sqs.remindersQueue,
  reminderMarkedSentQueue: sqs.reminderMarkedSentQueue,
  pingsTable: db.pingsTable,
  pingRemindersTable: db.pingRemindersTable,
  ...commonStackProps,
});
pingsProcessor.addDependency(sqs);
pingsProcessor.addDependency(db);

const api = new ApiStack(app, `PingwayBackend`, {
  region,
  account,
  pingRemindersTable: db.pingRemindersTable,
  pingsTable: db.pingsTable,
  userPool: auth.userPool,
  addPingsQueue: sqs.addPingsQueue,
  ...commonStackProps,
});
api.addDependency(sqs);
api.addDependency(db);
api.addDependency(auth);

const webapp = new UIStack(app, `PingwayUI`, {
  region,
  identityPoolId: auth.identityPoolId,
  userPoolId: auth.userPoolId,
  userPoolClientId: auth.userPoolClientId,
  endpoint: api.url,
  ...commonStackProps,
});
webapp.addDependency(auth);
webapp.addDependency(api);
