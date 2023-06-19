import * as cdk from "aws-cdk-lib";
import * as amplify from "@aws-cdk/aws-amplify-alpha";

interface IProps extends cdk.StackProps {
  identityPoolId: string;
  userPoolId: string;
  userPoolClientId: string;
  region: string;
  endpoint: string;
}

export class UIStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: IProps) {
    super(scope, id, props);

    const clientAmplifyApp = new amplify.App(this, `${id}-App`, {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: "edgaraskazlauskas",
        repository: "pingway-client",
        // TODO refactor out as this costs $0.01 per day
        oauthToken: cdk.SecretValue.secretsManager("pingway-github-token"),
      }),
      environmentVariables: {
        IDENTITY_POOL_ID: props.identityPoolId,
        USER_POOL_ID: props.userPoolId,
        USER_POOL_CLIENT_ID: props.userPoolClientId,
        REGION: props.region,
        ENDPOINT: props.endpoint,
      },
    });

    new cdk.CfnOutput(this, "WEBAPP", {
      value: clientAmplifyApp.defaultDomain,
    });

    clientAmplifyApp.addBranch("master");
  }
}
