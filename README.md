# Serverless Lambda Edge PreExisting CloudFront
A Serverless Framework plugin which associates Lambda@Edge against pre-existing CloudFront distributions.

## Install

You can install this plugin from npm registry.

```shell
$ npm install --save-dev serverless-lambda-edge-pre-existing-cloudfront
```

## How it works

Configure serverless.yml

```yaml
functions:
  viewerRequest:
    handler: lambdaEdge/viewerRequest.handler
    events:
      - preExistingCloudFront:
          distributionId: xxxxxxx # CloudFront distribution ID you want to associate
          eventType: viewer-request # Choose event to trigger your Lambda function, which are `viewer-request`, `origin-request`, `origin-response` or `viewer-response`
          pathPattern: '*' # Specifying the CloudFront behavior
          includeBody: false # Whether including body or not within request

plugins:
  - serverless-lambda-edge-pre-existing-cloudfront
```

Run deploy
```
$ serverless deploy
```

You can specify additional configurations a `lambdaEdgePreExistingCloudFront` value in the custom section of your serverless.yml file.
A `validStages` value allows you to specify valid stage names for deploy Lambda@Edge.

```yaml
lambdaEdgePreExistingCloudFront:
  validStages:
    - staging
    - production
```