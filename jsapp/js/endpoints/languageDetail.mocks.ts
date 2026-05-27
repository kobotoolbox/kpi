import { http, HttpResponse } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { Language } from '#/api/models/language'

const languageDetailMock = http.get<never, never, Language>(endpoints.LANGUAGE_DETAIL_URL, () =>
  HttpResponse.json({
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
  }),
)

export default languageDetailMock
