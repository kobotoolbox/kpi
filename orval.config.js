import { operationName } from './orval.config.operationName';

module.exports = {
  'kpi-v2': {
    output: {
      mode: 'tags',
      workspace: './jsapp/js/api/',
      target: '.',
      schemas: './models',
      clean: true,

      client: 'react-query',
      httpClient: 'fetch',
      namingConvention: 'PamelCase',
      mock: true,
      indexFiles: false,
      biome: true,

      // baseUrl: 'https://api.example.com', // prepend https://api.example.com to all api calls
      urlEncodeParameters: true,

      override: {
        title: (title) => ``,
        operationName: operationName,
        enumGenerationType: 'enum',
        query: {
          shouldSplitQueryKey: true,
        }
      },
    },
    input: {
      target: 'http://kf.kobo.local/api/v2/schema',
    },
  },
}
