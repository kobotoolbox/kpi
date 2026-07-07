const { operationName } = require('./jsapp/js/api/orval.operationName.js')

module.exports = {
  'kpi-v2': {
    output: {
      mode: 'tags-split',
      workspace: './jsapp/js/api/',
      target: './react-query',
      schemas: './models',
      clean: true,

      client: (generatorClients) => {
        // Note: With a "custom" client schema gets generated with simpler types and is more readable.
        // TODO: from objects let's manually build global MutationKey, see https://github.com/TanStack/query/pull/8521
        return generatorClients['react-query']
      },
      httpClient: 'fetch',
      // Generate mocks in separate .msw.ts files to avoid bundling faker/msw in production
      // With mode: 'tags-split', mocks are generated separately from runtime code
      mock: true,
      indexFiles: false,
      biome: true,

      // baseUrl: 'https://api.example.com', // prepend https://api.example.com to all api calls
      urlEncodeParameters: true,

      override: {
        operationName: operationName, // Note: drop the annoying `ApiV2` prefix for everything.
        enumGenerationType: 'const', // Weirdly, 'enum' generates wrong imports.
        mutator: {
          path: './orval.mutator.ts', // Note: authentication is injected here.
          name: 'fetchWithAuth',
        },
        query: {
          shouldSplitQueryKey: true,
        },
      },
    },
    input: {
      target: './static/openapi/schema_v2.yaml',
      override: {
        // Strip XML responses before Orval generation.
        // The frontend only consumes JSON.
        transformer: './scripts/orval-strip-xml.js',
      },
    },
    hooks: {
      // Orval has a bug that fails to generate imports for $ref in additionalProperties.
      // See https://github.com/orval-labs/orval/issues/1077.
      // Also fix TypeScript errors in MSW mock factories for types with index signatures.
      // Make trailing slashes optional in MSW handlers to match both /path and /path/
      // Rename files to index.ts/msw.ts pattern for clean imports
      afterAllFilesWrite: [
        'node scripts/orval-rename-to-index.js',
        'node scripts/orval-fix-referenced-additional-properties.js',
        'node scripts/orval-fix-mock-factory-type-assertions.js',
        'node scripts/orval-make-trailing-slash-optional.js',
        'node scripts/orval-remove-mock-delays.js',
      ],
    },
  },
}
