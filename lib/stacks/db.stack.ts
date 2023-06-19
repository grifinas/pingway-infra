import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { PING_REMINDERS_TABLE_USER_PING_GSI } from "@edgaraskazlauskas/pingway-backend";

export class DbStack extends cdk.Stack {
  pingsTable: dynamodb.Table;
  pingRemindersTable: dynamodb.Table;
  usersTable: dynamodb.Table;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.pingsTable = this.createPingsTable();
    this.pingRemindersTable = this.createPingRemindersTable();
    this.usersTable = this.createUsersTable();
  }

  private createUsersTable() {
    const usersTable = new dynamodb.Table(this, `UsersTable`, {
      partitionKey: {
        name: "UserId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "Email",
        type: dynamodb.AttributeType.STRING,
      },
    });

    return usersTable;
  }

  private createPingsTable() {
    const pingsTable = new dynamodb.Table(this, `PingsTable`, {
      partitionKey: {
        name: "UserId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "PingId",
        type: dynamodb.AttributeType.STRING,
      },
      readCapacity: 1,
      writeCapacity: 1,
    });

    return pingsTable;
  }

  private createPingRemindersTable() {
    const pingRemindersTable = new dynamodb.Table(this, `PingRemindersTable`, {
      partitionKey: {
        name: "PingId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "PingReminderId",
        type: dynamodb.AttributeType.STRING,
      },
      readCapacity: 1,
      writeCapacity: 1,
    });
    pingRemindersTable.addGlobalSecondaryIndex({
      readCapacity: 1,
      writeCapacity: 1,
      indexName: PING_REMINDERS_TABLE_USER_PING_GSI,
      partitionKey: {
        name: "UserId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "PingId",
        type: dynamodb.AttributeType.STRING,
      },
    });

    return pingRemindersTable;
  }
}
