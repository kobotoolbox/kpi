import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import type { SubmissionAttachment } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import {
  getBulkProcessingColumnKey,
  getVisibleBulkProcessingSubmissionUuidsToRefresh,
  hasAnyTranscribableAudio,
  hasAnyTranslatableTranscript,
  hasTranscribableAudio,
  hasTranslatableTranscript,
  isBulkProcessingCellInProgress,
} from './bulkProcessingUtils'

describe('bulkProcessingUtils', () => {
  const submission = assetDataFactory(1)

  function buildAttachment(overrides: Partial<SubmissionAttachment> = {}): SubmissionAttachment {
    return {
      download_url: 'http://localhost/media/mock-attachment.mp3',
      mimetype: 'audio/mp3',
      filename: 'mock-attachment.mp3',
      media_file_basename: 'mock-attachment.mp3',
      question_xpath: 'Secret_password_as_an_audio_file',
      uid: 'mock-attachment-uid',
      ...overrides,
    }
  }

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

    const notVisibleSubmission = assetDataFactory(2)

    const test = getVisibleBulkProcessingSubmissionUuidsToRefresh(prev, [], [notVisibleSubmission])

    chai.expect(test).to.deep.equal([])
  })

  describe('hasTranscribableAudio', () => {
    const audioQuestionXpath = 'Secret_password_as_an_audio_file'

    it('should return true for an attachment of given question', () => {
      const test = hasTranscribableAudio(
        assetDataFactory(1, {
          _attachments: [buildAttachment({ question_xpath: audioQuestionXpath, uid: 'att1' })],
        }),
        audioQuestionXpath,
      )

      chai.expect(test).to.be.true
    })

    it('should return false for a deleted attachment', () => {
      const test = hasTranscribableAudio(
        assetDataFactory(1, {
          _attachments: [buildAttachment({ question_xpath: audioQuestionXpath, uid: 'att1', is_deleted: true })],
        }),
        audioQuestionXpath,
      )

      chai.expect(test).to.be.false
    })

    it('should return false for an attachment of another question', () => {
      const test = hasTranscribableAudio(
        assetDataFactory(1, {
          _attachments: [buildAttachment({ question_xpath: 'Some_other_question', uid: 'att1' })],
        }),
        audioQuestionXpath,
      )

      chai.expect(test).to.be.false
    })

    it('should return false when there are no attachments at all', () => {
      chai.expect(hasTranscribableAudio(assetDataFactory(1), audioQuestionXpath)).to.be.false
    })
  })

  describe('hasAnyTranscribableAudio', () => {
    const audioQuestionXpath = 'Secret_password_as_an_audio_file'

    const audioSubmission = assetDataFactory(1, {
      _attachments: [buildAttachment({ question_xpath: audioQuestionXpath, uid: 'att1' })],
    })

    const deletedAudioSubmission = assetDataFactory(2, {
      _attachments: [buildAttachment({ question_xpath: audioQuestionXpath, uid: 'att2', is_deleted: true })],
    })

    const noAudioSubmission = assetDataFactory(3)

    it('should return false for an empty selection', () => {
      chai.expect(hasAnyTranscribableAudio([], audioQuestionXpath)).to.be.false
    })

    it('should return false when no selected submission has audio', () => {
      const test = hasAnyTranscribableAudio([noAudioSubmission, deletedAudioSubmission], audioQuestionXpath)

      chai.expect(test).to.be.false
    })

    it('should return true when at least one submission has audio', () => {
      const test = hasAnyTranscribableAudio(
        [noAudioSubmission, deletedAudioSubmission, audioSubmission],
        audioQuestionXpath,
      )

      chai.expect(test).to.be.true
    })
  })

  describe('hasTranslatableTranscript', () => {
    const transcriptColumnKey = '_supplementalDetails/Secret_password_as_an_audio_file/transcript_en'

    it('should return true for an approved transcript', () => {
      const test = hasTranslatableTranscript(
        assetDataFactory(1, {
          _supplementalDetails: {
            Secret_password_as_an_audio_file: {
              transcript: { languageCode: 'en', value: 'Hello world' },
            },
          },
        }),
        transcriptColumnKey,
      )

      chai.expect(test).to.be.true
    })

    it('should return false for a transcript still awaiting approval', () => {
      const test = hasTranslatableTranscript(
        assetDataFactory(1, {
          _supplementalDetails: {
            Secret_password_as_an_audio_file: {
              transcript: { languageCode: 'en', pendingReview: true },
            },
          },
        }),
        transcriptColumnKey,
      )

      chai.expect(test).to.be.false
    })

    it('should return false when there is no transcript at all', () => {
      const test = hasTranslatableTranscript(
        assetDataFactory(1, { _supplementalDetails: { Secret_password_as_an_audio_file: {} } }),
        transcriptColumnKey,
      )

      chai.expect(test).to.be.false
    })

    it('should return false when there are no supplemental details', () => {
      const test = hasTranslatableTranscript(assetDataFactory(1), transcriptColumnKey)

      chai.expect(test).to.be.false
    })

    it('should return false for a transcript of another question', () => {
      const test = hasTranslatableTranscript(
        assetDataFactory(1, {
          _supplementalDetails: {
            Some_other_question: {
              transcript: { languageCode: 'en', value: 'Hello world' },
            },
          },
        }),
        transcriptColumnKey,
      )

      chai.expect(test).to.be.false
    })
  })

  describe('hasAnyTranslatableTranscript', () => {
    const transcriptColumnKey = '_supplementalDetails/Secret_password_as_an_audio_file/transcript_en'

    const approvedTranscriptSubmission = assetDataFactory(1, {
      _supplementalDetails: {
        Secret_password_as_an_audio_file: {
          transcript: { languageCode: 'en', value: 'Hello world' },
        },
      },
    })

    const pendingTranscriptSubmission = assetDataFactory(2, {
      _supplementalDetails: {
        Secret_password_as_an_audio_file: {
          transcript: { languageCode: 'en', pendingReview: true },
        },
      },
    })

    const noTranscriptSubmission = assetDataFactory(3)

    it('should return false for an empty selection', () => {
      chai.expect(hasAnyTranslatableTranscript([], transcriptColumnKey)).to.be.false
    })

    it('should return false when no selected submission has a transcript', () => {
      const test = hasAnyTranslatableTranscript([noTranscriptSubmission, noTranscriptSubmission], transcriptColumnKey)

      chai.expect(test).to.be.false
    })

    it('should return false when all transcripts are still awaiting approval', () => {
      const test = hasAnyTranslatableTranscript(
        [pendingTranscriptSubmission, noTranscriptSubmission],
        transcriptColumnKey,
      )

      chai.expect(test).to.be.false
    })

    it('should return true when at least one transcript is approved', () => {
      const test = hasAnyTranslatableTranscript(
        [noTranscriptSubmission, pendingTranscriptSubmission, approvedTranscriptSubmission],
        transcriptColumnKey,
      )

      chai.expect(test).to.be.true
    })
  })
})
