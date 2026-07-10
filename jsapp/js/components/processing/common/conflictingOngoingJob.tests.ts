import chai from 'chai'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import bulkActionFactory from '#/endpoints/bulkAction.factory'
import { isConflictingOngoingJobForSubmission } from './conflictingOngoingJob'

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
        bulkActionFactory(submissionUuid, 'en', {
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

  it('returns false for transcript when action is complete', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        bulkActionFactory(submissionUuid, 'en', {
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
        bulkActionFactory(submissionUuid, 'fr', {
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
        bulkActionFactory(submissionUuid, 'en', {
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

  it('returns true for translation when ongoing transcription exists on same field and submission', () => {
    const result = isConflictingOngoingJobForSubmission({
      activeBulkActions: [
        bulkActionFactory(submissionUuid, 'en', {
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
})
