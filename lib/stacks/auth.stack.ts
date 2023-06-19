import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { getServiceEntryFile, Service } from "lib/helpers/entry.helpers";
import {
  getCommonLambdaEnvironmentProps,
  getLambdaTracingProps,
} from "lib/helpers/lambda.helpers";

export interface IAuthProps extends cdk.StackProps {
  region: string;
  usersTable: dynamodb.Table;
}

export class AuthStack extends cdk.Stack {
  public readonly authorizer: apigw.IAuthorizer;
  public readonly identityPoolId: string;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;
  public readonly userPool: cognito.UserPool;

  constructor(scope: cdk.App, id: string, props: IAuthProps) {
    super(scope, id, props);

    const addUserFn = new lambda.NodejsFunction(this, `AddUserFn`, {
      entry: getServiceEntryFile(Service.UsersSynchronization, "AddUser"),
      environment: {
        USERS_TABLE: props.usersTable.tableName,
        REGION: props.region,
      },
      ...getCommonLambdaEnvironmentProps(),
      ...getLambdaTracingProps(),
    });
    props.usersTable.grantReadWriteData(addUserFn);

    /**
     * User pools allow creating and managing your own directory of users that can sign up and sign in.
     * They enable easy integration with social identity providers such as Facebook, Google, Amazon, Microsoft Active Directory, etc. through SAML.
     */
    const userPool = new cognito.UserPool(this, `${id}-UserPool`, {
      selfSignUpEnabled: true,
      userVerification: {
        emailSubject: "Verify your email to start using Pingway!",
        emailBody: "Thanks for signing up! Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      lambdaTriggers: {
        postConfirmation: addUserFn,
        postAuthentication: addUserFn,
      },
    });
    this.userPool = userPool;

    const userPoolClient = new cognito.UserPoolClient(
      this,
      `${id}-UserPoolClient`,
      {
        userPool,
        generateSecret: false,
      }
    );

    const identityPool = new cognito.CfnIdentityPool(
      this,
      `${id}-IdentityPool`,
      {
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
          },
        ],
      }
    );

    new cdk.CfnOutput(this, "IDENTITY_POOL_ID", {
      value: identityPool.ref,
    });
    new cdk.CfnOutput(this, "USER_POOL_ID", {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "USER_POOL_CLIENT_ID", {
      value: userPoolClient.userPoolClientId,
    });

    this.identityPoolId = identityPool.ref;
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;
  }
}
