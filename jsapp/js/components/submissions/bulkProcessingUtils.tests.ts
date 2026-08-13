import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import type { SubmissionAttachment, TransxObject } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import {
  getBlockedBulkTranslationLanguages,
  getBulkProcessingColumnKey,
  getVisibleBulkProcessingSubmissionUuidsToRefresh,
  hasAnyTranscribableAudio,
  hasAnyTranslatableTranscript,
  hasTranscribableAudio,
  hasTranscriptInAnyLanguage,
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

  // Without root uuid matching the spinner would vanish mid-job, making a running transcription look finished.
  it('should detect in-progress cells for a submission that was edited after the job started', () => {
    const editedSubmission = assetDataFactory(1, {
      _uuid: 'edited-uuid-1',
      'meta/rootUuid': 'uuid:root-uuid-1',
    })

    const test = isBulkProcessingCellInProgress(
      [
        buildBulkAction({
          submission_uuids: ['root-uuid-1'],
          submission_statuses: [
            {
              uuid: 'root-uuid-1',
              status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
              error: null,
            },
          ],
        }),
      ],
      editedSubmission,
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

  it('should return the root uuid of a visible submission that was edited after the job started', () => {
    const editedSubmission = assetDataFactory(1, {
      _uuid: 'edited-uuid-1',
      'meta/rootUuid': 'uuid:root-uuid-1',
    })

    const prev = [
      buildBulkAction({
        uid: 'bulk-action-edited',
        submission_uuids: ['root-uuid-1'],
        submission_statuses: [
          {
            uuid: 'root-uuid-1',
            status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
            error: null,
          },
        ],
      }),
    ]

    const test = getVisibleBulkProcessingSubmissionUuidsToRefresh(prev, [], [editedSubmission])

    chai.expect(test).to.deep.equal(['root-uuid-1'])
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

    it('should return false for a transcript in another language than the column', () => {
      // A question holds one transcript, and it belongs to the column of its own language. So this row is empty in the
      // English column and has nothing for it to translate.
      const test = hasTranslatableTranscript(
        assetDataFactory(1, {
          _supplementalDetails: {
            Secret_password_as_an_audio_file: {
              transcript: { languageCode: 'es', value: 'Hola mundo' },
            },
          },
        }),
        transcriptColumnKey,
      )

      chai.expect(test).to.be.false
    })
  })

  describe('hasTranscriptInAnyLanguage', () => {
    const transcriptColumnKey = '_supplementalDetails/Secret_password_as_an_audio_file/transcript_en'

    it('should return true for a transcript in another language than the column', () => {
      // Pinning the language-blindness on purpose: an English transcription would overwrite this Spanish
      // transcript, so it has to count as existing content.
      const test = hasTranscriptInAnyLanguage(
        assetDataFactory(1, {
          _supplementalDetails: {
            Secret_password_as_an_audio_file: {
              transcript: { languageCode: 'es', value: 'Hola mundo' },
            },
          },
        }),
        transcriptColumnKey,
      )

      chai.expect(test).to.be.true
    })

    it('should return true for a transcript still awaiting approval', () => {
      const test = hasTranscriptInAnyLanguage(
        assetDataFactory(1, {
          _supplementalDetails: {
            Secret_password_as_an_audio_file: {
              transcript: { languageCode: 'en', pendingReview: true },
            },
          },
        }),
        transcriptColumnKey,
      )

      chai.expect(test).to.be.true
    })

    it('should return false when there is no transcript at all', () => {
      const test = hasTranscriptInAnyLanguage(
        assetDataFactory(1, { _supplementalDetails: { Secret_password_as_an_audio_file: {} } }),
        transcriptColumnKey,
      )

      chai.expect(test).to.be.false
    })

    it('should return false for a transcript of another question', () => {
      const test = hasTranscriptInAnyLanguage(
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

    const otherLanguageTranscriptSubmission = assetDataFactory(4, {
      _supplementalDetails: {
        Secret_password_as_an_audio_file: {
          transcript: { languageCode: 'es', value: 'Hola mundo' },
        },
      },
    })

    it('should return false for an empty selection', () => {
      chai.expect(hasAnyTranslatableTranscript([], transcriptColumnKey)).to.be.false
    })

    it('should return false when no selected submission has a transcript', () => {
      const test = hasAnyTranslatableTranscript([noTranscriptSubmission, noTranscriptSubmission], transcriptColumnKey)

      chai.expect(test).to.be.false
    })

    it('should return false when all transcripts are in another language than the column', () => {
      const test = hasAnyTranslatableTranscript(
        [otherLanguageTranscriptSubmission, noTranscriptSubmission],
        transcriptColumnKey,
      )

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

  describe('getBlockedBulkTranslationLanguages', () => {
    const questionXpath = 'Secret_password_as_an_audio_file'
    const englishColumnKey = `_supplementalDetails/${questionXpath}/transcript_en`

    function buildTranscriptSubmission(id: number, transcript: TransxObject) {
      return assetDataFactory(id, { _supplementalDetails: { [questionXpath]: { transcript } } })
    }

    it("should block the column's own language for an empty selection", () => {
      chai.expect(getBlockedBulkTranslationLanguages([], englishColumnKey)).to.deep.equal(['en'])
    })

    it("should block the column's own language when rows are transcribed in it", () => {
      const submissions = [buildTranscriptSubmission(1, { languageCode: 'en', value: 'Hello world' })]

      chai.expect(getBlockedBulkTranslationLanguages(submissions, englishColumnKey)).to.deep.equal(['en'])
    })

    it('should not block the language of a row transcribed in another language', () => {
      // A Spanish row got selected alongside the English ones. It is empty in this column and the `no-source` alert
      // drops it, so Spanish has to stay pickable as a target.
      const submissions = [
        buildTranscriptSubmission(1, { languageCode: 'en', value: 'Hello world' }),
        buildTranscriptSubmission(2, { languageCode: 'es', value: 'Hola mundo' }),
      ]

      chai.expect(getBlockedBulkTranslationLanguages(submissions, englishColumnKey)).to.deep.equal(['en'])
    })

    it('should block the locale of a translatable row on top of the column language', () => {
      // Nothing stops `regionCode` from disagreeing with `languageCode`, and the back end would translate this from
      // French. So French has to go too, or the undeletable empty column comes right back.
      const submissions = [buildTranscriptSubmission(1, { languageCode: 'en', regionCode: 'fr-CA', value: 'Bonjour' })]

      chai
        .expect(getBlockedBulkTranslationLanguages(submissions, englishColumnKey))
        .to.deep.equal(['en', 'fr-CA', 'fr'])
    })

    it('should ignore the locale of a row it cannot translate from', () => {
      // Same mismatched pair as above, but this row lives in the Spanish column, so this column never reads it.
      const submissions = [buildTranscriptSubmission(1, { languageCode: 'es', regionCode: 'fr-CA', value: 'Bonjour' })]

      chai.expect(getBlockedBulkTranslationLanguages(submissions, englishColumnKey)).to.deep.equal(['en'])
    })

    it('should ignore rows whose transcript is still awaiting approval', () => {
      const submissions = [
        buildTranscriptSubmission(1, { languageCode: 'en', regionCode: 'fr-CA', pendingReview: true }),
      ]

      chai.expect(getBlockedBulkTranslationLanguages(submissions, englishColumnKey)).to.deep.equal(['en'])
    })
  })
})
