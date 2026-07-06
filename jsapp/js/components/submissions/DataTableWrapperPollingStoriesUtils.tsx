import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import {
  getApiV2AssetsRetrieveMockHandler,
  getApiV2AssetsRetrieveResponseMock,
} from '#/api/react-query/manage-projects-and-library-content'
import { getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock } from '#/api/react-query/survey-data'
import { QuestionTypeName } from '#/constants'
import assetDataFactory from '#/endpoints/assetData.factory'
import meMock from '#/endpoints/me.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import organizationServiceUsageMock from '#/endpoints/organizationServiceUsage.mocks'
import { getBulkActionsPollingIntervalMs } from './useDataTableBulkActions'

let pollingBulkActionsCalls = 0
let pollingSubmissionRefreshCalls = 0
let pollingFirstBulkActionsRequestTime: number | null = null
const POLLING_STORY_ASSERTION_GRACE_MS = 6000
// How long after a story resets before the mock bulk action reports completion.
// Needs to be shorter than the polling interval (8 s for translation) so that
// the first poll always returns in_progress — giving every parallel browser
// enough time to actually render the "Processing" cell before completion fires.
const POLLING_COMPLETE_AFTER_MS = 2000

// Dedicated polling story data is kept in a separate file so the main stories
// file remains easy to scan as more table scenarios get added.
export const pollingAsset = getApiV2AssetsRetrieveResponseMock({
  uid: 'audio-asset-uid-polling',
  name: 'Audio form with polling update',
  // The backend writes analysis_form_json when a bulk action is created, so
  // this entry is present from the moment the story starts — not only after
  // polling finishes. Having it here is what keeps the supplemental column in
  // its correct position (immediately after the source question) throughout the
  // whole lifecycle. The virtual fields from active bulk actions handle the
  // "Processing" cell state while the action is still running.
  analysis_form_json: {
    additional_fields: [
      {
        language: 'es',
        source: 'Record_a_sound',
        type: 'translation',
        name: 'translation_es',
        dtpath: 'Record_a_sound/translation_es',
      },
    ],
  },
  content: {
    schema: '1',
    survey: [
      {
        type: QuestionTypeName.audio,
        $kuid: 'snd1',
        label: ['Record a sound'],
        $xpath: 'Record_a_sound',
        required: false,
        $autoname: 'Record_a_sound',
      },
    ],
    settings: {},
    translated: ['label'],
    translations: [null],
  },
  effective_permissions: [{ codename: 'change_submissions' }],
})

const pollingSubmissionInitial = assetDataFactory(11, {
  Record_a_sound: 'test11.mp3',
  _attachments: [
    {
      download_url: './test11.mp3',
      mimetype: 'audio/x-m3a',
      filename: 'uu/attachments/test11.mp3',
      media_file_basename: 'test11.mp3',
      uid: 'tst11',
      is_deleted: false,
      question_xpath: 'Record_a_sound',
    },
  ],
})

const pollingSubmissionUpdated = assetDataFactory(11, {
  Record_a_sound: 'test11.mp3',
  _supplementalDetails: {
    Record_a_sound: {
      translation: {
        es: {
          languageCode: 'es',
          value: 'Hola, el procesamiento masivo ha finalizado correctamente.',
        },
      },
    },
  },
  _attachments: [
    {
      download_url: './test11.mp3',
      mimetype: 'audio/x-m3a',
      filename: 'uu/attachments/test11.mp3',
      media_file_basename: 'test11.mp3',
      uid: 'tst11',
      is_deleted: false,
      question_xpath: 'Record_a_sound',
    },
  ],
})

const pollingBulkActionInProgress = getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
  uid: 'polling-bulk-action',
  status: BulkActionResponseStatusEnum.in_progress,
  action_id: ActionIdEnum.automatic_google_translation,
  question_xpath: 'Record_a_sound',
  submission_uuids: [pollingSubmissionInitial['meta/rootUuid']],
  params: { language: 'es' },
  submission_statuses: [
    {
      uuid: pollingSubmissionInitial['meta/rootUuid'],
      status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
      error: null,
    },
  ],
})

const pollingBulkActionComplete = getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
  uid: 'polling-bulk-action',
  status: BulkActionResponseStatusEnum.complete,
  action_id: ActionIdEnum.automatic_google_translation,
  question_xpath: 'Record_a_sound',
  submission_uuids: [pollingSubmissionInitial['meta/rootUuid']],
  params: { language: 'es' },
  submission_statuses: [
    {
      uuid: pollingSubmissionInitial['meta/rootUuid'],
      status: BulkActionSubmissionStatusResponseStatusEnum.complete,
      error: null,
    },
  ],
})

export function resetPollingUpdateStoryHandlers() {
  pollingBulkActionsCalls = 0
  pollingSubmissionRefreshCalls = 0
  pollingFirstBulkActionsRequestTime = null
}

export function getPollingUpdateStoryState() {
  return {
    pollingBulkActionsCalls,
    pollingSubmissionRefreshCalls,
  }
}

export function getPollingUpdateStoryTimeoutMs() {
  const pollingIntervalMs = getBulkActionsPollingIntervalMs([pollingBulkActionInProgress])

  if (pollingIntervalMs === false) {
    return POLLING_STORY_ASSERTION_GRACE_MS
  }

  // The UI change happens after one more poll and one row refresh request, so
  // the test allows one computed interval plus a small render/network cushion.
  return pollingIntervalMs + POLLING_STORY_ASSERTION_GRACE_MS
}

export function getPollingUpdateStoryHandlers() {
  return [
    meMock,
    getApiV2AssetsRetrieveMockHandler(pollingAsset),
    organizationMock(),
    organizationServiceUsageMock(),
    http.get<PathParams<'uid'>, never>(endpoints.ASSET_ADVANCED_FEATURES_BULK_ACTIONS, ({ params }) => {
      if (params.uid !== pollingAsset.uid) {
        return undefined
      }

      // Use wall-clock time rather than call count to decide when to switch to
      // complete. A call-count threshold is unreliable when multiple browsers
      // run the same story in parallel — their polls all share the same counter,
      // so the count can cross the threshold before any single browser has had
      // a chance to render the "Processing" cell.
      pollingBulkActionsCalls += 1
      if (pollingFirstBulkActionsRequestTime === null) {
        pollingFirstBulkActionsRequestTime = Date.now()
      }
      const isComplete = Date.now() - pollingFirstBulkActionsRequestTime >= POLLING_COMPLETE_AFTER_MS
      return HttpResponse.json({
        count: 1,
        next: null,
        previous: null,
        results: [isComplete ? pollingBulkActionComplete : pollingBulkActionInProgress],
      })
    }),
    http.get<PathParams<'uid'>, never>(endpoints.ASSET_DATA_URL, ({ params, request }) => {
      if (params.uid !== pollingAsset.uid) {
        return undefined
      }

      // DataTable uses the regular list call for the page, and a query-based call
      // when refreshing one submission by uuid; we return updated data only for
      // that single-row refresh path.
      const requestUrl = new URL(request.url)
      const hasUuidQuery = Boolean(requestUrl.searchParams.get('query'))
      if (hasUuidQuery) {
        pollingSubmissionRefreshCalls += 1
      }
      const submissions = hasUuidQuery ? [pollingSubmissionUpdated] : [pollingSubmissionInitial]

      return HttpResponse.json({
        count: submissions.length,
        next: null,
        previous: null,
        results: submissions,
      })
    }),
  ]
}
