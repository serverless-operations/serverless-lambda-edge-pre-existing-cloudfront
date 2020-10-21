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
        # ---- Mandatory Properties -----
          distributionId: xxxxxxx # CloudFront distribution ID you want to associate
          eventType: viewer-request # Choose event to trigger your Lambda function, which are `viewer-request`, `origin-request`, `origin-response` or `viewer-response`
          pathPattern: '*' # Specifying the CloudFront behavior
          includeBody: false # Whether including body or not within request
        # ---- Optional Property -----
          stage: dev # Specify the stage at which you want this CloudFront distribution to be updated

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

### How `validStages` and `stage` properties work
This plugin will first check for `validStages` property defined in the `custom` section. If `validStages` is used, then all the `preExistingCloudFront` events are only possible to be updated at the `validStages`. If not used, all the `preExistingCloudFront` events are possible to be updated at any stage.

Then at all valid stages, the plugin checks - for each `preExistingCloudFront` event - if the provider's stage is the same as the `stage` property defined for each `preExistingCloudFront` event. If they match, then that particular `preExistingCloudFront` event will be updated.

If `stage` is not used for a `preExistingCloudFront` event, then that event will be updated at all `validStages` or all stages if `validStages` is not used.