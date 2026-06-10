import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import type { SubmissionResponse } from '#/dataInterface'
import {
  getBulkProcessingColumnKey,
  getVisibleBulkProcessingSubmissionUuidsToRefresh,
  isBulkProcessingCellInProgress,
} from './bulkProcessingUtils'

describe('bulkProcessingUtils', () => {
  const submission = {
    _uuid: 'faa38eee-4e3f-419e-bac0-e95f1085d998',
    'meta/rootUuid': 'uuid:faa38eee-4e3f-419e-bac0-e95f1085d998',
  } as SubmissionResponse

  function buildBulkAction(overrides: Partial<BulkActionResponse> = {}) {
    return {
      uid: 'bulk-action-1',
      status: BulkActionResponseStatusEnum.in_progress,
      action_id: ActionIdEnum.automatic_google_transcription,
      question_xpath: 'Secret_password_as_an_audio_file',
      submission_uuids: [submission._uuid],
      submission_statuses: [
        {
          uuid: submission._uuid,
          status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
          error: null,
        },
      ],
      params: {
        language: 'fr',
      },
      progress: 50,
      created_by: {
        username: 'leszek',
      },
      date_created: '2026-05-13T00:00:00Z',
      date_modified: '2026-05-13T00:00:00Z',
      ...overrides,
    } as BulkActionResponse
  }

  it('should build transcript supplemental column keys from bulk actions', () => {
    const test = getBulkProcessingColumnKey(buildBulkAction())

    chai.expect(test).to.equal('_supplementalDetails/Secret_password_as_an_audio_file/transcript_fr')
  })

  it('should build translation supplemental column keys from bulk actions', () => {
    const test = getBulkProcessingColumnKey(
      buildBulkAction({
        action_id: ActionIdEnum.automatic_google_translation,
        params: { language: 'pl' },
      }),
    )

    chai.expect(test).to.equal('_supplementalDetails/Secret_password_as_an_audio_file/translation_pl')
  })

  it('should detect in-progress bulk processing cells for the matching submission and column', () => {
    const test = isBulkProcessingCellInProgress(
      [buildBulkAction()],
      submission,
      '_supplementalDetails/Secret_password_as_an_audio_file/transcript_fr',
    )

    chai.expect(test).to.equal(true)
  })

  it('should ignore bulk actions for other columns or finished submission statuses', () => {
    const test = isBulkProcessingCellInProgress(
      [
        buildBulkAction({
          submission_statuses: [
            {
              uuid: submission._uuid,
              status: BulkActionSubmissionStatusResponseStatusEnum.complete,
              error: null,
            },
          ],
        }),
      ],
      submission,
      '_supplementalDetails/Secret_password_as_an_audio_file/transcript_fr',
    )

    chai.expect(test).to.equal(false)
  })

  it('should return visible submission uuid when status transitions to complete', () => {
    const prev = [
      buildBulkAction({
        uid: 'bulk-action-transition',
        submission_statuses: [
          {
            uuid: submission._uuid,
            status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
            error: null,
          },
        ],
      }),
    ]
    const next = [
      buildBulkAction({
        uid: 'bulk-action-transition',
        submission_statuses: [
          {
            uuid: submission._uuid,
            status: BulkActionSubmissionStatusResponseStatusEnum.complete,
            error: null,
          },
        ],
      }),
    ]

    const test = getVisibleBulkProcessingSubmissionUuidsToRefresh(prev, next, [submission])

    chai.expect(test).to.deep.equal([submission._uuid])
  })

  it('should return visible uuid when previously active action disappears', () => {
    const prev = [
      buildBulkAction({
        uid: 'bulk-action-gone',
        submission_statuses: [
          {
            uuid: submission._uuid,
            status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
            error: null,
          },
        ],
      }),
    ]

    const test = getVisibleBulkProcessingSubmissionUuidsToRefresh(prev, [], [submission])

    chai.expect(test).to.deep.equal([submission._uuid])
  })

  it('should return empty list when matching submission is not visible', () => {
    const prev = [
      buildBulkAction({
        uid: 'bulk-action-hidden',
        submission_statuses: [
          {
            uuid: submission._uuid,
            status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
            error: null,
          },
        ],
      }),
    ]

    const notVisibleSubmission = {
      _uuid: 'another-uuid',
      'meta/rootUuid': 'uuid:another-uuid',
    } as SubmissionResponse

    const test = getVisibleBulkProcessingSubmissionUuidsToRefresh(prev, [], [notVisibleSubmission])

    chai.expect(test).to.deep.equal([])
  })
})
