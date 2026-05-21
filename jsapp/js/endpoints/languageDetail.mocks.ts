import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { PaginatedResponse } from '#/dataInterface'
import type { ListLanguage } from '../components/languages/languagesStore'
import {Language} from '#/api/models/language'

const languageDetailMock = http.get<never, never,Language>(
  endpoints.LANGUAGE_DETAIL_URL,
  () =>
    HttpResponse.json({
      name: 'English',
      code: 'en',
      featured: true,
      regions: [
        { code: 'en-US', name: 'United States' },
        { code: 'en-GB', name: 'United Kingdom' },
      ],
      transcription_services: {
        'goog': {
          'en-US': 'en-US',
          'en-GB': 'en-GB',
        }
      },
      translation_services: {
        'goog': {
          'en-US': 'en-US',
          'en-GB': 'en-GB',
        }
      }
    })
)

//const languageDetailMock = http.get('/api/v2/languages/:language_id/', (info) => {
//  return HttpResponse.json({
//    name: 'English',
//    code: 'en',
//    featured: true,
//    regions: [
//      { code: 'en-US', name: 'United States' },
//      { code: 'en-GB', name: 'United Kingdom' },
//    ],
//    transcription_services: {
//      'goog': {
//        'en-US': 'en-US',
//        'en-GB': 'en-GB',
//      }
//    },
//    translation_services: {
//      'goog': {
//        'en-US': 'en-US',
//        'en-GB': 'en-GB',
//      }
//    }
//  })
//})

export default languageDetailMock
