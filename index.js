'use strict'

class ServerlessLambdaEdgePreExistingCloudFront {
  constructor(serverless, options) {
    this.serverless = serverless
    this.options = options || {}
    this.provider = this.serverless.getProvider('aws')
    this.service = this.serverless.service.service
    this.region = this.provider.getRegion()
    this.stage = this.provider.getStage()

    this.hooks = {
      'after:aws:deploy:finalize:cleanup': async () => {
        await this.serverless.service
          .getAllFunctions()
          .filter((functionName) => {
            const functionObj = this.serverless.service.getFunction(functionName)
            return functionObj.events
          })
          .reduce((promiseOutput, functionName) => {
            return promiseOutput.then(async () => {
              const functionObj = this.serverless.service.getFunction(functionName)
              const events = functionObj.events.filter(
                (event) => event.preExistingCloudFront && this.checkAllowedDeployStage()
              )
              for (let idx = 0; idx < events.length; idx += 1) {
                const event = events[idx]

                if (event.preExistingCloudFront.stage !== undefined &&
                  event.preExistingCloudFront.stage != `${this.stage}`) { continue }

                const functionArn = await this.getlatestVersionLambdaArn(functionObj.name)
                const resolvedDistributionId = await (event.preExistingCloudFront.distributionId['Fn::ImportValue']
                    ? this.resolveCfImportValue(this.provider, event.preExistingCloudFront.distributionId['Fn::ImportValue'])
                    : event.preExistingCloudFront.distributionId
                )
                this.serverless.cli.consoleLog(
                  `${functionArn} (Event: ${event.preExistingCloudFront.eventType}, pathPattern: ${event.preExistingCloudFront.pathPattern}) is associating to ${resolvedDistributionId} CloudFront Distribution. waiting for deployed status.`
                )

                let retryCount = 5

                const updateDistribution = async () => {
                  const config = await this.provider.request('CloudFront', 'getDistribution', {
                    Id: resolvedDistributionId
                  })

                  if (event.preExistingCloudFront.pathPattern === '*') {
                    config.DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations = await this.associateFunction(
                      config.DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations,
                      event,
                      functionObj.name,
                      functionArn
                    )
                  } else {
                    config.DistributionConfig.CacheBehaviors = await this.associateNonDefaultCacheBehaviors(
                      config.DistributionConfig.CacheBehaviors,
                      event,
                      functionObj.name,
                      functionArn
                    )
                  }

                  await this.provider
                    .request('CloudFront', 'updateDistribution', {
                      Id: resolvedDistributionId,
                      IfMatch: config.ETag,
                      DistributionConfig: config.DistributionConfig
                    })
                    .catch(async (error) => {
                      if (error.providerError.code === 'PreconditionFailed' && retryCount > 0) {
                        this.serverless.cli.consoleLog(
                          `received precondition failed error, retrying... (${retryCount}/5)`
                        )
                        retryCount -= 1
                        await new Promise((res) => setTimeout(res, 5000))
                        return updateDistribution()
                      }
                      this.serverless.cli.consoleLog(error)
                      throw error
                    })
                }

                await updateDistribution()
              }
            })
          }, Promise.resolve())
      }
    }

    if (this.serverless.configSchemaHandler) {
      this.serverless.configSchemaHandler.defineCustomProperties({
        type: 'object',
        properties: {
          lambdaEdgePreExistingCloudFront: {
            type: 'object',
            properties: {
              validStages: {
                type: 'array',
                items: { type: 'string' },
                uniqueItems: true
              }
            }
          }
        }
      })

      this.serverless.configSchemaHandler.defineFunctionEvent('aws', 'preExistingCloudFront', {
        type: 'object',
        properties: {
          distributionId: {
            anyOf: [{ type: 'string' }, { type: 'object' }],
          },
          eventType: { type: 'string' },
          pathPattern: { type: 'string' },
          includeBody: { type: 'boolean' },
          stage: { type: 'string' }
        },
        required: ['distributionId', 'eventType', 'pathPattern', 'includeBody']
      })
    }
  }

  checkAllowedDeployStage() {
    if (
      this.serverless.service.custom &&
      this.serverless.service.custom.lambdaEdgePreExistingCloudFront &&
      this.serverless.service.custom.lambdaEdgePreExistingCloudFront.validStages
    ) {
      if (
        this.serverless.service.custom.lambdaEdgePreExistingCloudFront.validStages.indexOf(
          this.stage
        ) < 0
      ) {
        return false
      }
    }
    return true
  }

  async associateNonDefaultCacheBehaviors(cacheBehaviors, event, functionName, functionArn) {
    for (let i = 0; i < cacheBehaviors.Items.length; i++) {
      if (event.preExistingCloudFront.pathPattern === cacheBehaviors.Items[i].PathPattern) {
        cacheBehaviors.Items[i].LambdaFunctionAssociations = await this.associateFunction(
          cacheBehaviors.Items[i].LambdaFunctionAssociations,
          event,
          functionName,
          functionArn
        )
      }
    }
    return cacheBehaviors
  }

  async associateFunction(lambdaFunctionAssociations, event, functionName, functionArn) {
    const originals = lambdaFunctionAssociations.Items.filter(
      (x) => x.EventType !== event.preExistingCloudFront.eventType
    )
    lambdaFunctionAssociations.Items = originals
    lambdaFunctionAssociations.Items.push({
      LambdaFunctionARN: functionArn,
      IncludeBody: event.preExistingCloudFront.includeBody,
      EventType: event.preExistingCloudFront.eventType
    })
    lambdaFunctionAssociations.Quantity = lambdaFunctionAssociations.Items.length
    return lambdaFunctionAssociations
  }

  async getlatestVersionLambdaArn(functionName, marker) {
    const args = {
      FunctionName: functionName,
      MaxItems: 50
    }

    if (marker) {
      args['Marker'] = marker
    }

    const versions = await this.provider.request('Lambda', 'listVersionsByFunction', args)

    if (versions.NextMarker !== null) {
      return await this.getlatestVersionLambdaArn(functionName, versions.NextMarker)
    }
    let arn
    versions.Versions.forEach(async (functionObj) => {
      arn = functionObj.FunctionArn
    })
    return arn
  }

  resolveCfImportValue(provider, name, sdkParams = {}) {
    return provider.request('CloudFormation', 'listExports', sdkParams).then(result => {
      const targetExportMeta = result.Exports.find(exportMeta => exportMeta.Name === name);
      if (targetExportMeta) return targetExportMeta.Value;
      if (result.NextToken) {
        return this.resolveCfImportValue(provider, name, { NextToken: result.NextToken });
      }

      throw new Error(
        `Could not resolve Fn::ImportValue with name ${name}. Are you sure this value is exported ?`
      );
    });
  }
}
module.exports = ServerlessLambdaEdgePreExistingCloudFront
