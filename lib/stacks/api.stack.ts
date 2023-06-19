import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { getServiceEntryFile, Service } from "lib/helpers/entry.helpers";
import {
  getCommonLambdaEnvironmentProps,
  getLambdaTracingProps,
} from "lib/helpers/lambda.helpers";

export interface IApiProps extends cdk.StackProps {
  region: string;
  account: string;
  pingsTable: dynamodb.Table;
  pingRemindersTable: dynamodb.Table;
  userPool: UserPool;
  addPingsQueue: sqs.Queue;
}

export class ApiStack extends cdk.Stack {
  public url: string;

  constructor(scope: cdk.App, id: string, props: IApiProps) {
    super(scope, id, props);

    const { pingRemindersTable, pingsTable, addPingsQueue, userPool } = props;

    const authorizer = this.createAuthorizer(userPool);

    const getPingFn = this.createGetPingFn(pingsTable);
    const addPingFn = this.createAddPingFn(
      props,
      pingsTable,
      pingRemindersTable,
      addPingsQueue
    );
    const getPingsFn = this.createGetPingsFn(pingsTable, pingRemindersTable);
    const addReminderFn = this.createAddReminderFn(pingRemindersTable);

    const api = this.createApi(
      id,
      getPingsFn,
      addPingFn,
      getPingFn,
      addReminderFn,
      authorizer
    );

    new cdk.CfnOutput(this, "ENDPOINT", {
      value: api.url,
    });
  }

  private createAuthorizer(userPool: UserPool) {
    return new apigw.CognitoUserPoolsAuthorizer(this, `ApiAuthorizer`, {
      cognitoUserPools: [userPool],
      identitySource: apigw.IdentitySource.header("Authorization"),
    });
  }

  private createApi(
    id: string,
    getPingsFn: lambda.NodejsFunction,
    addPingFn: lambda.NodejsFunction,
    getPingFn: lambda.NodejsFunction,
    addReminderFn: lambda.NodejsFunction,
    authorizer: apigw.IAuthorizer
  ) {
    const api = new apigw.RestApi(this, `${id}-RestApi`, {
      defaultCorsPreflightOptions: {
        allowHeaders: apigw.Cors.DEFAULT_HEADERS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowCredentials: true,
        allowOrigins: apigw.Cors.ALL_ORIGINS,
      },
    });

    this.url = api.url;

    const pingsResource = api.root.addResource("pings");
    pingsResource.addMethod("GET", new apigw.LambdaIntegration(getPingsFn), {
      authorizer,
    });
    pingsResource.addMethod("POST", new apigw.LambdaIntegration(addPingFn), {
      authorizer,
    });

    const pingResource = pingsResource.addResource("{pingId}");
    pingResource.addMethod("GET", new apigw.LambdaIntegration(getPingFn), {
      authorizer,
    });
    const remindersResource = pingResource.addResource("reminders");
    remindersResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(addReminderFn),
      {
        authorizer,
      }
    );

    return api;
  }

  private createGetPingsFn(
    pingsTable: dynamodb.Table,
    pingRemindersTable: dynamodb.Table
  ) {
    const fn = new lambda.NodejsFunction(this, `GetPingsFn`, {
      entry: getServiceEntryFile(Service.Api, "GetPings"),
      environment: {
        PINGS_TABLE: pingsTable.tableName,
        PING_REMINDERS_TABLE: pingRemindersTable.tableName,
      },
      ...getCommonLambdaEnvironmentProps(),
      ...getLambdaTracingProps(),
    });

    pingsTable.grantReadData(fn);
    pingRemindersTable.grantReadData(fn);

    return fn;
  }

  private createAddPingFn(
    props: IApiProps,
    pingsTable: dynamodb.Table,
    pingRemindersTable: dynamodb.Table,
    addPingsQueue: sqs.Queue
  ) {
    const fn = new lambda.NodejsFunction(this, `AddPingFn`, {
      entry: getServiceEntryFile(Service.Api, "AddPing"),
      environment: {
        REGION: props.region,
        PINGS_TABLE: pingsTable.tableName,
        PING_REMINDERS_TABLE: pingRemindersTable.tableName,
        ADD_PING_QUEUE_URL: addPingsQueue.queueUrl,
      },
      ...getCommonLambdaEnvironmentProps(),
      ...getLambdaTracingProps(),
    });

    addPingsQueue.grantSendMessages(fn);

    return fn;
  }

  private createGetPingFn(pingsTable: dynamodb.Table) {
    const fn = new lambda.NodejsFunction(this, `GetPingFn`, {
      entry: getServiceEntryFile(Service.Api, "GetPing"),
      environment: {
        PINGS_TABLE: pingsTable.tableName,
      },
      ...getCommonLambdaEnvironmentProps(),
      ...getLambdaTracingProps(),
    });

    pingsTable.grantReadData(fn);

    return fn;
  }

  private createAddReminderFn(
    pingRemindersTable: dynamodb.Table
  ): lambda.NodejsFunction {
    const fn = new lambda.NodejsFunction(this, `AddReminderFn`, {
      entry: getServiceEntryFile(Service.Api, "AddReminder"),
      environment: {
        PING_REMINDERS_TABLE: pingRemindersTable.tableName,
      },
      ...getCommonLambdaEnvironmentProps(),
      ...getLambdaTracingProps(),
    });

    pingRemindersTable.grantReadWriteData(fn);

    return fn;
  }
}
