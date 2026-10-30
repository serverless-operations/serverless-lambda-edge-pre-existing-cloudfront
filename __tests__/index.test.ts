import { CloudFormationClient, ListExportsCommand } from '@aws-sdk/client-cloudformation'
import {
  CloudFrontClient,
  GetDistributionCommand,
  UpdateDistributionCommand
} from '@aws-sdk/client-cloudfront'
import { LambdaClient, ListVersionsByFunctionCommand } from '@aws-sdk/client-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ServerlessLambdaEdgePreExistingCloudFront from '../src/index'

const lambdaMock = mockClient(LambdaClient)
const cloudfrontMock = mockClient(CloudFrontClient)
const cloudformationMock = mockClient(CloudFormationClient)

const functionArn = 'arn:aws:lambda:us-east-1:123456789012:function:viewer-request:3'

type Event = Record<string, unknown>

const createServerless = (events: Event[], stage = 'dev', custom: Record<string, unknown> = {}) =>
  ({
    getProvider: () => ({ getStage: () => stage }),
    service: {
      provider: { region: 'us-east-1', stage },
      custom,
      getAllFunctions: () => ['viewerRequest'],
      getFunction: () => ({ name: 'viewer-request', events })
    },
    configSchemaHandler: {
      defineCustomProperties: vi.fn(),
      defineFunctionEvent: vi.fn()
    }
  }) as never

const createPlugin = (serverless: never) =>
  new ServerlessLambdaEdgePreExistingCloudFront(
    serverless,
    {} as never,
    {
      log: { notice: vi.fn(), error: vi.fn() }
    } as never
  )

const distribution = () => ({
  ETag: 'etag-1',
  Distribution: {
    DistributionConfig: {
      DefaultCacheBehavior: {
        LambdaFunctionAssociations: {
          Quantity: 1,
          Items: [{ EventType: 'viewer-request', LambdaFunctionARN: 'arn:old', IncludeBody: false }]
        }
      },
      CacheBehaviors: {
        Quantity: 1,
        Items: [
          {
            PathPattern: '/api/*',
            LambdaFunctionAssociations: { Quantity: 0, Items: [] }
          }
        ]
      }
    }
  }
})

const event = (overrides: Event = {}) => ({
  preExistingCloudFront: {
    distributionId: 'E123',
    eventType: 'viewer-request',
    pathPattern: '*',
    includeBody: false,
    ...overrides
  }
})

const updatedConfig = () =>
  cloudfrontMock.commandCalls(UpdateDistributionCommand)[0].args[0].input.DistributionConfig

describe('ServerlessLambdaEdgePreExistingCloudFront', () => {
  beforeEach(() => {
    lambdaMock.reset()
    cloudfrontMock.reset()
    cloudformationMock.reset()
    lambdaMock.on(ListVersionsByFunctionCommand).resolves({
      Versions: [{ FunctionArn: 'arn:$LATEST' }, { FunctionArn: functionArn }]
    })
    cloudfrontMock.on(GetDistributionCommand).resolves(distribution() as never)
    cloudfrontMock.on(UpdateDistributionCommand).resolves({})
  })

  it('registers the deploy hook and config schema', () => {
    const serverless = createServerless([])
    const plugin = createPlugin(serverless)

    expect(plugin.hooks['after:aws:deploy:finalize:cleanup']).toBeTypeOf('function')
    expect(
      (serverless as { configSchemaHandler: { defineFunctionEvent: ReturnType<typeof vi.fn> } })
        .configSchemaHandler.defineFunctionEvent
    ).toHaveBeenCalledWith('aws', 'preExistingCloudFront', expect.any(Object))
  })

  it('replaces the association of the same event type on the default cache behavior', async () => {
    await createPlugin(createServerless([event()])).setupLambdaEdgePreExistingCloudFront()

    const config = updatedConfig()
    expect(cloudfrontMock.commandCalls(UpdateDistributionCommand)[0].args[0].input).toMatchObject({
      Id: 'E123',
      IfMatch: 'etag-1'
    })
    expect(config.DefaultCacheBehavior.LambdaFunctionAssociations).toEqual({
      Quantity: 1,
      Items: [{ EventType: 'viewer-request', LambdaFunctionARN: functionArn, IncludeBody: false }]
    })
  })

  it('associates the function with a matching non-default cache behavior', async () => {
    await createPlugin(
      createServerless([event({ pathPattern: '/api/*', eventType: 'origin-request' })])
    ).setupLambdaEdgePreExistingCloudFront()

    expect(updatedConfig().CacheBehaviors.Items[0].LambdaFunctionAssociations).toEqual({
      Quantity: 1,
      Items: [{ EventType: 'origin-request', LambdaFunctionARN: functionArn, IncludeBody: false }]
    })
  })

  it('resolves a distribution id from a CloudFormation export', async () => {
    cloudformationMock
      .on(ListExportsCommand)
      .resolvesOnce({ Exports: [{ Name: 'other', Value: 'x' }], NextToken: 'page-2' })
      .resolvesOnce({ Exports: [{ Name: 'cdn-id', Value: 'E999' }] })

    await createPlugin(
      createServerless([event({ distributionId: { 'Fn::ImportValue': 'cdn-id' } })])
    ).setupLambdaEdgePreExistingCloudFront()

    expect(cloudfrontMock.commandCalls(GetDistributionCommand)[0].args[0].input.Id).toBe('E999')
  })

  it('skips events whose stage does not match the provider stage', async () => {
    await createPlugin(
      createServerless([event({ stage: 'prod' })], 'dev')
    ).setupLambdaEdgePreExistingCloudFront()

    expect(cloudfrontMock.commandCalls(UpdateDistributionCommand)).toHaveLength(0)
  })

  it('skips all events when the stage is not in validStages', async () => {
    await createPlugin(
      createServerless([event()], 'dev', {
        lambdaEdgePreExistingCloudFront: { validStages: ['prod'] }
      })
    ).setupLambdaEdgePreExistingCloudFront()

    expect(cloudfrontMock.commandCalls(UpdateDistributionCommand)).toHaveLength(0)
  })

  it('updates when the stage is in validStages', async () => {
    await createPlugin(
      createServerless([event()], 'prod', {
        lambdaEdgePreExistingCloudFront: { validStages: ['prod'] }
      })
    ).setupLambdaEdgePreExistingCloudFront()

    expect(cloudfrontMock.commandCalls(UpdateDistributionCommand)).toHaveLength(1)
  })
})
