import chai from 'chai'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import { getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock } from '#/api/react-query/survey-data/msw'
import { isConflictingOngoingJobForSubmission } from './conflictingOngoingJob'

function buildBulkAction(
  submissionUuid: string,
  language: string,
  overrides: Partial<BulkActionResponse> = {},
): BulkActionResponse {
  const status = overrides.status ?? BulkActionResponseStatusEnum.in_progress
  // These jobs hold one submission, so its status matches the job's. Every job
  // status has a submission status of the same name, so we can just look it up.
  const submissionStatus = BulkActionSubmissionStatusResponseStatusEnum[status]

  return getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
    uid: `bulk-${submissionUuid}-${language}`,
    status,
    action_id: ActionIdEnum.automatic_google_transcription,
    question_xpath: 'audio_question',
    submission_uuids: [submissionUuid],
    submission_statuses: [{ uuid: submissionUuid, status: submissionStatus, error: null }],
    params: { language },
    progress: 0,
    created_by: { username: 'tester' },
    date_created: '2026-01-01T00:00:00Z',
    date_modified: '2026-01-01T00:00:00Z',
    ...overrides,
  })
}

describe('isConflictingOngoingJobForSubmission', () => {
  const submissionUuid = 'submission-1'
  const fieldXpath = 'audio_question'

  it('returns false when there are no actions', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [],
      actionType: 'transcript',
      fieldXpath,
      submissionUuid,
      selectedLanguage: 'en',
    })

    chai.expect(result).to.equal(false)
  })

  it('returns true for transcript when ongoing transcription conflicts on same field and submission', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'en', {
          action_id: ActionIdEnum.automatic_google_transcription,
          question_xpath: fieldXpath,
          status: BulkActionResponseStatusEnum.in_progress,
        }),
      ],
      actionType: 'transcript',
      fieldXpath,
      submissionUuid,
      selectedLanguage: 'en',
    })

    chai.expect(result).to.equal(true)
  })

  it('returns true for transcript when ongoing translation exists on same field and submission', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'fr', {
          action_id: ActionIdEnum.automatic_google_translation,
          question_xpath: fieldXpath,
          status: BulkActionResponseStatusEnum.in_progress,
        }),
      ],
      actionType: 'transcript',
      fieldXpath,
      submissionUuid,
      selectedLanguage: 'en',
    })

    chai.expect(result).to.equal(true)
  })

  it('returns false for transcript when action is complete', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'en', {
          action_id: ActionIdEnum.automatic_google_transcription,
          question_xpath: fieldXpath,
          status: BulkActionResponseStatusEnum.complete,
        }),
      ],
      actionType: 'transcript',
      fieldXpath,
      submissionUuid,
      selectedLanguage: 'en',
    })

    chai.expect(result).to.equal(false)
  })

  it('returns true for translation when ongoing translation conflicts on same language', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'fr', {
          action_id: ActionIdEnum.automatic_google_translation,
          question_xpath: fieldXpath,
          status: BulkActionResponseStatusEnum.pending,
        }),
      ],
      actionType: 'translation',
      fieldXpath,
      submissionUuid,
      selectedLanguage: 'fr',
    })

    chai.expect(result).to.equal(true)
  })

  it('returns false for translation when ongoing translation is on different language', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'en', {
          action_id: ActionIdEnum.automatic_google_translation,
          question_xpath: fieldXpath,
          status: BulkActionResponseStatusEnum.in_progress,
        }),
      ],
      actionType: 'translation',
      fieldXpath,
      submissionUuid,
      selectedLanguage: 'fr',
    })

    chai.expect(result).to.equal(false)
  })

  // The translations tab warns before the user has picked a target language, so
  // at that point any ongoing translation counts as a conflict.
  it('returns true for translation with no selected language when any translation is ongoing', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'es', {
          action_id: ActionIdEnum.automatic_google_translation,
          question_xpath: fieldXpath,
          status: BulkActionResponseStatusEnum.in_progress,
        }),
      ],
      actionType: 'translation',
      fieldXpath,
      submissionUuid,
    })

    chai.expect(result).to.equal(true)
  })

  it('returns false for translation with no selected language when the only translation job is done', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'es', {
          action_id: ActionIdEnum.automatic_google_translation,
          question_xpath: fieldXpath,
          status: BulkActionResponseStatusEnum.complete,
        }),
      ],
      actionType: 'translation',
      fieldXpath,
      submissionUuid,
    })

    chai.expect(result).to.equal(false)
  })

  it('returns false for translation with no selected language when the job targets another question', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'es', {
          action_id: ActionIdEnum.automatic_google_translation,
          question_xpath: 'other_question',
          status: BulkActionResponseStatusEnum.in_progress,
        }),
      ],
      actionType: 'translation',
      fieldXpath,
      submissionUuid,
    })

    chai.expect(result).to.equal(false)
  })

  // Whether the target language already has a translation is deliberately not
  // this helper's business - it only reports running jobs, and the language step
  // hides already-translated languages. These two pin that down: same job, same
  // verdict, regardless of what the submission has been translated into.
  it('ignores whether the selected language already has a translation', () => {
    const ongoingSpanishJob = [
      buildBulkAction(submissionUuid, 'es', {
        action_id: ActionIdEnum.automatic_google_translation,
        question_xpath: fieldXpath,
        status: BulkActionResponseStatusEnum.in_progress,
      }),
    ]

    // Same language as the job, which is the case where a translation may already exist.
    chai
      .expect(
        isConflictingOngoingJobForSubmission({
          activeBulkActions: ongoingSpanishJob,
          actionType: 'translation',
          fieldXpath,
          submissionUuid,
          selectedLanguage: 'es',
        }),
      )
      .to.equal(true)

    // A language the job isn't touching stays free to translate into.
    chai
      .expect(
        isConflictingOngoingJobForSubmission({
          activeBulkActions: ongoingSpanishJob,
          actionType: 'translation',
          fieldXpath,
          submissionUuid,
          selectedLanguage: 'de',
        }),
      )
      .to.equal(false)
  })

  it('returns true for translation when ongoing transcription exists on same field and submission', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        buildBulkAction(submissionUuid, 'en', {
          action_id: ActionIdEnum.automatic_google_transcription,
          question_xpath: fieldXpath,
          status: BulkActionResponseStatusEnum.in_progress,
        }),
      ],
      actionType: 'translation',
      fieldXpath,
      submissionUuid,
      selectedLanguage: 'fr',
    })

    chai.expect(result).to.equal(true)
  })

  // Reviewing one submission while the rest of its batch is still running.
  describe('with a partially finished job', () => {
    const siblingUuid = 'submission-2'

    function buildPartiallyFinishedAction(overrides: Partial<BulkActionResponse> = {}) {
      return buildBulkAction(submissionUuid, 'en', {
        action_id: ActionIdEnum.automatic_google_transcription,
        question_xpath: fieldXpath,
        status: BulkActionResponseStatusEnum.in_progress,
        submission_uuids: [submissionUuid, siblingUuid],
        submission_statuses: [
          { uuid: submissionUuid, status: BulkActionSubmissionStatusResponseStatusEnum.complete, error: null },
          { uuid: siblingUuid, status: BulkActionSubmissionStatusResponseStatusEnum.in_progress, error: null },
        ],
        ...overrides,
      })
    }

    it('returns false for the submission that the job already finished', () => {
      const result = isConflictingOngoingJobForSubmission({
        activeBulkActions: [buildPartiallyFinishedAction()],
        actionType: 'transcript',
        fieldXpath,
        submissionUuid,
        selectedLanguage: 'en',
      })

      chai.expect(result).to.equal(false)
    })

    it('returns true for the sibling submission that the job is still processing', () => {
      const result = isConflictingOngoingJobForSubmission({
        activeBulkActions: [buildPartiallyFinishedAction()],
        actionType: 'transcript',
        fieldXpath,
        submissionUuid: siblingUuid,
        selectedLanguage: 'en',
      })

      chai.expect(result).to.equal(true)
    })

    it('returns false for a submission whose own processing failed', () => {
      const result = isConflictingOngoingJobForSubmission({
        activeBulkActions: [
          buildPartiallyFinishedAction({
            submission_statuses: [
              { uuid: submissionUuid, status: BulkActionSubmissionStatusResponseStatusEnum.failed, error: 'nope' },
              { uuid: siblingUuid, status: BulkActionSubmissionStatusResponseStatusEnum.in_progress, error: null },
            ],
          }),
        ],
        actionType: 'transcript',
        fieldXpath,
        submissionUuid,
        selectedLanguage: 'en',
      })

      chai.expect(result).to.equal(false)
    })

    it('returns true for a submission still queued behind an in-progress sibling', () => {
      const result = isConflictingOngoingJobForSubmission({
        activeBulkActions: [
          buildPartiallyFinishedAction({
            submission_statuses: [
              { uuid: submissionUuid, status: BulkActionSubmissionStatusResponseStatusEnum.pending, error: null },
              { uuid: siblingUuid, status: BulkActionSubmissionStatusResponseStatusEnum.in_progress, error: null },
            ],
          }),
        ],
        actionType: 'transcript',
        fieldXpath,
        submissionUuid,
        selectedLanguage: 'en',
      })

      chai.expect(result).to.equal(true)
    })

    it('matches submission uuids regardless of the default uuid prefix', () => {
      const result = isConflictingOngoingJobForSubmission({
        activeBulkActions: [
          buildPartiallyFinishedAction({
            submission_statuses: [
              {
                uuid: `uuid:${submissionUuid}`,
                status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
                error: null,
              },
            ],
          }),
        ],
        actionType: 'transcript',
        fieldXpath,
        submissionUuid,
        selectedLanguage: 'en',
      })

      chai.expect(result).to.equal(true)
    })
  })
})
