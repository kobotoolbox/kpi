import { getApiV2LanguagesRetrieveMockHandler } from '#/api/react-query/other'

/**
 * Mock API for language detail endpoint using Orval-generated handler.
 * Uses specific English language data for testing.
 */
const languageDetailMock = getApiV2LanguagesRetrieveMockHandler({
  name: 'English',
  code: 'en',
  featured: true,
  regions: [
    { code: 'en-US', name: 'United States' },
    { code: 'en-GB', name: 'United Kingdom' },
  ],
  transcription_services: {
    goog: {
      'en-US': 'en-US',
      'en-GB': 'en-GB',
    },
  },
  translation_services: {
    goog: {
      'en-US': 'en-US',
      'en-GB': 'en-GB',
    },
  },
})

export default languageDetailMock
