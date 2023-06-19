import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";

export class SqsStack extends cdk.Stack {
  readonly remindersQueue: sqs.Queue;
  readonly addPingsQueue: sqs.Queue;
  readonly reminderMarkedSentQueue: sqs.Queue;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.addPingsQueue = this.createAddPingSqsQueue();
    this.remindersQueue = this.createRemindersSqsQueue();
    this.reminderMarkedSentQueue = this.createReminderMarkedSentQueue();
  }

  private createRemindersSqsQueue() {
    const dlq = new sqs.Queue(this, "RemindersQueueDLQ");
    return new sqs.Queue(this, "RemindersQueue", {
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });
  }

  private createAddPingSqsQueue() {
    const dlq = new sqs.Queue(this, "StorePingCommandQueueDLQ");
    return new sqs.Queue(this, "StorePingCommandQueue", {
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });
  }

  private createReminderMarkedSentQueue() {
    const dlq = new sqs.Queue(this, "ReminderMarkedSentQueueDLQ");
    return new sqs.Queue(this, "ReminderMarkedSentQueue", {
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });
  }
}
