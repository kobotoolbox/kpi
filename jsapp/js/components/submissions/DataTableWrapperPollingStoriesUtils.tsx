import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import { QuestionTypeName } from '#/constants'
import assetFactory from '#/endpoints/asset.factory'
import assetMock from '#/endpoints/asset.mocks'
import assetDataFactory from '#/endpoints/assetData.factory'
import bulkActionFactory from '#/endpoints/bulkAction.factory'
import meMock from '#/endpoints/me.mocks'
import organizationMock from '#/endpoints/organization.mocks'
import organizationServiceUsageMock from '#/endpoints/organizationServiceUsage.mocks'

// Dedicated polling story data is kept in a separate file so the main stories
// file remains easy to scan as more table scenarios get added.
export const pollingAsset = assetFactory({
  uid: 'audio-asset-uid-polling',
  name: 'Audio form with polling update',
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
  _supplementalDetails: {
    Record_a_sound: {
      translation: {
        es: {
          languageCode: 'es',
          value: 'Hola, este valor llega despues del polling.',
        },
      },
    },
  },
})

const pollingBulkActionInProgress = bulkActionFactory(pollingSubmissionInitial['meta/rootUuid'], 'es', {
  uid: 'polling-bulk-action',
  status: BulkActionResponseStatusEnum.in_progress,
  action_id: ActionIdEnum.automatic_google_translation,
  question_xpath: 'Record_a_sound',
  submission_statuses: [
    {
      uuid: pollingSubmissionInitial['meta/rootUuid'],
      status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
    },
  ],
})

const pollingBulkActionComplete = bulkActionFactory(pollingSubmissionInitial['meta/rootUuid'], 'es', {
  uid: 'polling-bulk-action',
  status: BulkActionResponseStatusEnum.in_progress,
  action_id: ActionIdEnum.automatic_google_translation,
  question_xpath: 'Record_a_sound',
  submission_statuses: [
    {
      uuid: pollingSubmissionInitial['meta/rootUuid'],
      status: BulkActionSubmissionStatusResponseStatusEnum.complete,
    },
  ],
})

export function getPollingUpdateStoryHandlers() {
  // We deliberately make this stateful to mimic one poll cycle where the item
  // is still in progress and the next cycle where it becomes complete.
  let bulkActionsCalls = 0

  return [
    meMock,
    assetMock(pollingAsset.uid, pollingAsset),
    organizationMock(),
    organizationServiceUsageMock(),
    http.get<PathParams<'uid'>, never>(endpoints.ASSET_ADVANCED_FEATURES_BULK_ACTIONS, ({ params }) => {
      if (params.uid !== pollingAsset.uid) {
        return undefined
      }

      bulkActionsCalls += 1
      return HttpResponse.json({
        count: 1,
        next: null,
        previous: null,
        results: [bulkActionsCalls >= 2 ? pollingBulkActionComplete : pollingBulkActionInProgress],
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