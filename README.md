# Serverless Lambda Edge PreExisting CloudFront
The Serverless Framework plugin which associates Lambda@Edge against pre-existing CloudFront distribution.

## Install

You can install this plugin from npm registry.

```shell
$ npm install --save-dev serverless-lambda-edge-pre-existing-cloudfront
```

## How it works

Here is configuration in your serverless.yml

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

And run deploy
```
$ serverless deploy
```