import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { getServiceEntryFile, Service } from "lib/helpers/entry.helpers";
import {
  getCommonLambdaEnvironmentProps,
  getLambdaTracingProps,
} from "lib/helpers/lambda.helpers";

interface IProps extends cdk.StackProps {
  storePingsQueue: sqs.Queue;
  remindersQueue: sqs.Queue;
  reminderMarkedSentQueue: sqs.Queue;
  pingsTable: dynamodb.Table;
  pingRemindersTable: dynamodb.Table;
  region: string;
}

export class PingsProcessorStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: IProps) {
    super(scope, id, props);

    const storePingsHandlerFn = this.createStorePingsHandlerFn(
      props.pingsTable,
      props.pingRemindersTable,
      props.storePingsQueue
    );
    storePingsHandlerFn.addEventSource(
      new lambdaEventSources.SqsEventSource(props.storePingsQueue, {
        batchSize: 1, // Due to low write throughput
      })
    );

    const unsentRemindersCronHandlerFn =
      this.createUnsentRemindersCronHandlerFn(
        props.pingsTable,
        props.pingRemindersTable,
        props.remindersQueue,
        props.region
      );

    /**
     * SQS Reminders queue populator
     * Every 5 minutes it will call a lambda that will collect reminders to be sent and add them to reminders queue
     */
    new events.Rule(this, `UnsentRemindersCronHandlerSchedule`, {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(unsentRemindersCronHandlerFn)],
    });

    const dueReminderHandlerFn = this.createDueReminderHandlerFn(
      props.pingRemindersTable,
      props.remindersQueue,
      props.reminderMarkedSentQueue
    );
    dueReminderHandlerFn.addEventSource(
      new lambdaEventSources.SqsEventSource(props.remindersQueue, {
        batchSize: 1, // Due to low write throughput
      })
    );
  }

  private createUnsentRemindersCronHandlerFn(
    pingsTable: dynamodb.Table,
    pingRemindersTable: dynamodb.Table,
    remindersQueue: sqs.Queue,
    region: string
  ) {
    const fn = new lambda.NodejsFunction(
      this,
      `ProcessUnsentRemindersCronHandlerFn`,
      {
        entry: getServiceEntryFile(
          Service.PingsProcessor,
          "ProcessUnsentRemindersCronHandler"
        ),
        environment: {
          PINGS_TABLE: pingsTable.tableName,
          PING_REMINDERS_TABLE: pingRemindersTable.tableName,
          REMINDERS_QUEUE_URL: remindersQueue.queueUrl,
          REGION: region,
        },
        ...getCommonLambdaEnvironmentProps(),
        ...getLambdaTracingProps(),
      }
    );

    remindersQueue.grantSendMessages(fn);

    pingsTable.grantReadData(fn);
    pingRemindersTable.grantReadData(fn);

    return fn;
  }

  private createDueReminderHandlerFn(
    pingRemindersTable: dynamodb.Table,
    remindersQueue: sqs.Queue,
    reminderMarkedSentQueue: sqs.Queue
  ) {
    const fn = new lambda.NodejsFunction(
      this,
      `ReminderReachedDueDateHandlerFn`,
      {
        entry: getServiceEntryFile(
          Service.PingsProcessor,
          "ReminderReachedDueDateHandler"
        ),
        environment: {
          PING_REMINDERS_TABLE: pingRemindersTable.tableName,
          REMINDERS_MARKED_SENT_QUEUE_URL: reminderMarkedSentQueue.queueUrl,
        },
        ...getCommonLambdaEnvironmentProps(),
        ...getLambdaTracingProps(),
      }
    );

    remindersQueue.grantConsumeMessages(fn);

    reminderMarkedSentQueue.grantSendMessages(fn);
    pingRemindersTable.grantReadWriteData(fn);

    return fn;
  }

  private createStorePingsHandlerFn(
    pingsTable: dynamodb.Table,
    pingRemindersTable: dynamodb.Table,
    storePingsQueue: sqs.Queue
  ) {
    const fn = new lambda.NodejsFunction(this, `StorePingsHandlerFn`, {
      entry: getServiceEntryFile(Service.PingsProcessor, "StorePingsHandler"),
      environment: {
        PINGS_TABLE: pingsTable.tableName,
        PING_REMINDERS_TABLE: pingRemindersTable.tableName,
      },
      ...getCommonLambdaEnvironmentProps(),
      ...getLambdaTracingProps(),
    });

    storePingsQueue.grantConsumeMessages(fn);

    pingsTable.grantReadWriteData(fn);
    pingRemindersTable.grantReadWriteData(fn);

    return fn;
  }
}
