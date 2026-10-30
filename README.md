# Serverless Lambda Edge PreExisting CloudFront
A Serverless Framework plugin which associates Lambda@Edge against pre-existing CloudFront distributions.

## Install

You can install this plugin from npm registry.

```shell
$ npm install --save-dev @flaconi/serverless-lambda-edge-pre-existing-cloudfront
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
  - '@flaconi/serverless-lambda-edge-pre-existing-cloudfront'
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

## Development

```shell
yarn install
yarn compile   # type check (TypeScript 7)
yarn lint
yarn test      # vitest, with coverage
yarn build     # emits CommonJS + typings to dist/
```

The plugin is built as CommonJS, because the Serverless Framework (OSLS) loads plugins with `require`.

### TypeScript toolchain

Type checking and the build run on **TypeScript 7** (the native compiler). TypeScript 7.0 does not
ship a programmatic API yet, so TypeScript 6 is installed alongside it for `typescript-eslint`,
following the [side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0):

```json
"@typescript/native": "npm:typescript@^7.0.2",
"typescript": "npm:@typescript/typescript6@^6.0.2"
```

* `yarn compile` / `yarn build` → TypeScript 7
* `yarn tsc6` → TypeScript 6 checker, to cross-check a diagnostic
* `import ... from 'typescript'` → TypeScript 6 API

`node_modules/.bin/tsc` resolves to TypeScript 6, so always run the compiler through `yarn`, not
`npx tsc`. The compatibility package has no `lib/tsserver.js` either. The aliases look like a
mistake to Dependabot: a `development` group bump must keep both. Drop the `typescript` alias once
TypeScript 7.1 ships the programmatic API and typescript-eslint supports it.

## Releasing

The package is published as the private `@flaconi/serverless-lambda-edge-pre-existing-cloudfront`
on npmjs.org. The source stays public; CI uses the public
[`Flaconi/github-reusable-workflow`](https://github.com/Flaconi/github-reusable-workflow)
`build-node.yml` / `publish-node.yml`, because a public repository can't call the private
`Flaconi/github-actions` workflows.

* **Release:** merge PRs to `master`. Release Drafter keeps a draft release `vX.Y.Z 🌈`; PR labels
  pick the bump (`breaking-change` → major, `feature` → minor, everything else → patch). Publishing
  the draft release publishes that version to npm (`latest`).
* **Never bump `version` by hand.** It is set from the release tag, and `bot-shop-ci` commits it back
  to `master`.
* **Beta builds:** every branch push that changes a path in `changed-files.yml` publishes
  `X.Y.Z-beta.<run_id>.0` with dist-tag `beta`, and `bot-shop-ci` commits that version to the branch.
  Pull before pushing again.
* **npm side:** publishing uses Trusted Publishing (OIDC), with no npm token in the repository. The
  package's Trusted Publisher is GitHub Actions · `Flaconi` /
  `serverless-lambda-edge-pre-existing-cloudfront` · workflow `release.yml`, and publishing access
  requires 2FA and disallows tokens.
