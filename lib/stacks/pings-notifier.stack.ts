import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { getServiceEntryFile, Service } from "lib/helpers/entry.helpers";
import {
  getCommonLambdaEnvironmentProps,
  getLambdaTracingProps,
} from "lib/helpers/lambda.helpers";

interface IProps extends cdk.StackProps {
  reminderMarkedSentQueue: sqs.Queue;
  pingsTable: dynamodb.Table;
  pingRemindersTable: dynamodb.Table;
  usersTable: dynamodb.Table;
}

export class PingsNotifierStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: IProps) {
    super(scope, id, props);

    const reminderMarkedSentHandlerFn = this.createReminderMarkedSentHandler(
      props.usersTable,
      props.pingsTable,
      props.pingRemindersTable,
      props.reminderMarkedSentQueue
    );

    reminderMarkedSentHandlerFn.addEventSource(
      new lambdaEventSources.SqsEventSource(props.reminderMarkedSentQueue)
    );
  }

  private createReminderMarkedSentHandler(
    usersTable: dynamodb.Table,
    pingsTable: dynamodb.Table,
    pingRemindersTable: dynamodb.Table,
    dueRemindersQueue: sqs.Queue
  ) {
    const fn = new lambda.NodejsFunction(this, `ReminderMarkedSentHandlerFn`, {
      entry: getServiceEntryFile(
        Service.PingsNotifications,
        "ReminderMarkedSentHandler"
      ),
      environment: {
        PINGS_TABLE: pingsTable.tableName,
        PING_REMINDERS_TABLE: pingRemindersTable.tableName,
        USERS_TABLE: usersTable.tableName,
        SES_SOURCE: "edgaras.dev@gmail.com",
      },
      ...getCommonLambdaEnvironmentProps(),
      ...getLambdaTracingProps(),
    });

    usersTable.grantReadData(fn);
    pingsTable.grantReadData(fn);
    pingRemindersTable.grantReadData(fn);

    dueRemindersQueue.grantConsumeMessages(fn);

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    return fn;
  }
}
