import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdacore from "aws-cdk-lib/aws-lambda";

export function getCommonLambdaEnvironmentProps(): Partial<lambda.NodejsFunctionProps> {
  return {
    bundling: {
      nodeModules: [],
    },
    runtime: lambdacore.Runtime.NODEJS_16_X,
  };
}

export function getLambdaTracingProps(): Partial<lambda.NodejsFunctionProps> {
  return {
    tracing: lambdacore.Tracing.ACTIVE,
  };
}
