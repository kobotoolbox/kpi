import { expect } from 'chai'
import assetDataFactory from '#/endpoints/assetData.factory'
import { evaluateNoEligibleSubmissions, evaluateNoSource } from './alertEvaluators'
import type { AlertEvaluationContext } from './types'

describe('evaluateNoEligibleSubmissions', () => {
  const mockSubmissions = [
    assetDataFactory(1, { _uuid: 'uuid-1' }),
    assetDataFactory(2, { _uuid: 'uuid-2' }),
    assetDataFactory(3, { _uuid: 'uuid-3' }),
  ]

  const baseContext: AlertEvaluationContext = {
    submissions: mockSubmissions,
    fieldXpath: 'question_1',
    actionType: 'transcript',
    activeBulkActions: [],
    previouslyFilteredSubmissionUuids: new Set(),
  }

  it('should show alert when all submissions are filtered', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      previouslyFilteredSubmissionUuids: new Set(['uuid-1', 'uuid-2', 'uuid-3']),
    }

    const result = evaluateNoEligibleSubmissions(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('error')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
    expect(result.computedValues).to.deep.equal({
      totalCount: 3,
      filteredCount: 3,
    })
  })

  it('should not show alert when some submissions remain eligible', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      previouslyFilteredSubmissionUuids: new Set(['uuid-1', 'uuid-2']),
    }

    const result = evaluateNoEligibleSubmissions(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('error')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
    expect(result.computedValues).to.deep.equal({
      totalCount: 3,
      filteredCount: 2,
    })
  })

  it('should not show alert when no submissions are filtered', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      previouslyFilteredSubmissionUuids: new Set(),
    }

    const result = evaluateNoEligibleSubmissions(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('error')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
    expect(result.computedValues).to.deep.equal({
      totalCount: 3,
      filteredCount: 0,
    })
  })

  it('should handle empty submissions array', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: [],
      previouslyFilteredSubmissionUuids: new Set(),
    }

    const result = evaluateNoEligibleSubmissions(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('error')
    expect(result.computedValues).to.deep.equal({
      totalCount: 0,
      filteredCount: 0,
    })
  })
})

describe('evaluateNoSource', () => {
  describe('for transcription', () => {
    const baseContext: AlertEvaluationContext = {
      submissions: [],
      fieldXpath: 'audio_question',
      actionType: 'transcript',
      activeBulkActions: [],
      previouslyFilteredSubmissionUuids: new Set(),
    }

    it('should not show alert when all submissions have audio attachments', () => {
      const mockSubmissions = [
        assetDataFactory(1, {
          _uuid: 'uuid-1',
          _attachments: [
            {
              question_xpath: 'audio_question',
              filename: 'audio1.mp3',
              mimetype: 'audio/mpeg',
              download_url: '/audio1.mp3',
              media_file_basename: 'audio1',
              is_deleted: false,
              uid: 'auid-1',
            },
          ],
        }),
        assetDataFactory(2, {
          _uuid: 'uuid-2',
          _attachments: [
            {
              question_xpath: 'audio_question',
              filename: 'audio2.mp3',
              mimetype: 'audio/mpeg',
              download_url: '/audio2.mp3',
              media_file_basename: 'audio2',
              is_deleted: false,
              uid: 'auid-2',
            },
          ],
        }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(false)
      expect(result.type).to.equal('warning')
      expect(result.filteredSubmissionUuids).to.deep.equal([])
    })

    it('should show alert when submissions are missing audio attachments', () => {
      const mockSubmissions = [
        assetDataFactory(1, {
          _uuid: 'uuid-1',
          _attachments: [
            {
              question_xpath: 'audio_question',
              filename: 'audio1.mp3',
              mimetype: 'audio/mpeg',
              download_url: '/audio1.mp3',
              media_file_basename: 'audio1',
              is_deleted: false,
              uid: 'auid-1',
            },
          ],
        }),
        assetDataFactory(2, { _uuid: 'uuid-2', _attachments: [] }),
        assetDataFactory(3, { _uuid: 'uuid-3' }), // No _attachments property
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(true)
      expect(result.type).to.equal('warning')
      expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-2', 'uuid-3'])
      expect(result.computedValues.count).to.equal(2)
    })

    it('should ignore deleted attachments', () => {
      const mockSubmissions = [
        assetDataFactory(1, {
          _uuid: 'uuid-1',
          _attachments: [
            {
              question_xpath: 'audio_question',
              filename: 'audio1.mp3',
              mimetype: 'audio/mpeg',
              download_url: '/audio1.mp3',
              media_file_basename: 'audio1',
              is_deleted: true,
              uid: 'auid-1',
            },
          ],
        }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(true)
      expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
    })

    it('should check correct field xpath', () => {
      const mockSubmissions = [
        assetDataFactory(1, {
          _uuid: 'uuid-1',
          _attachments: [
            {
              question_xpath: 'different_question',
              filename: 'audio1.mp3',
              mimetype: 'audio/mpeg',
              download_url: '/audio1.mp3',
              media_file_basename: 'audio1',
              is_deleted: false,
              uid: 'auid-1',
            },
          ],
        }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(true)
      expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
    })

    it('should skip submissions already filtered by previous evaluators', () => {
      const mockSubmissions = [
        assetDataFactory(1, { _uuid: 'uuid-1', _attachments: [] }),
        assetDataFactory(2, { _uuid: 'uuid-2', _attachments: [] }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
        previouslyFilteredSubmissionUuids: new Set(['uuid-1']),
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(true)
      expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
      expect(result.computedValues.count).to.equal(1)
    })
  })

  describe('for translation', () => {
    const baseContext: AlertEvaluationContext = {
      submissions: [],
      fieldXpath: 'audio_question',
      actionType: 'translation',
      activeBulkActions: [],
      previouslyFilteredSubmissionUuids: new Set(),
    }

    it('should not show alert when all submissions have transcripts', () => {
      const mockSubmissions = [
        assetDataFactory(1, {
          _uuid: 'uuid-1',
          _supplementalDetails: {
            audio_question: {
              transcript: { languageCode: 'en', value: 'Hello world' },
            },
          },
        }),
        assetDataFactory(2, {
          _uuid: 'uuid-2',
          _supplementalDetails: {
            audio_question: {
              transcript: { languageCode: 'en', value: 'Goodbye world' },
            },
          },
        }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(false)
      expect(result.type).to.equal('warning')
      expect(result.filteredSubmissionUuids).to.deep.equal([])
    })

    it('should show alert when submissions are missing transcripts', () => {
      const mockSubmissions = [
        assetDataFactory(1, {
          _uuid: 'uuid-1',
          _supplementalDetails: {
            audio_question: {
              transcript: { languageCode: 'en', value: 'Hello world' },
            },
          },
        }),
        assetDataFactory(2, { _uuid: 'uuid-2' }), // No supplemental details
        assetDataFactory(3, {
          _uuid: 'uuid-3',
          _supplementalDetails: {
            audio_question: {}, // No transcript
          },
        }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(true)
      expect(result.type).to.equal('warning')
      expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-2', 'uuid-3'])
      expect(result.computedValues.count).to.equal(2)
    })

    it('should flag submissions with empty transcript value', () => {
      const mockSubmissions = [
        assetDataFactory(1, {
          _uuid: 'uuid-1',
          _supplementalDetails: {
            audio_question: {
              transcript: { languageCode: 'en', value: '' },
            },
          },
        }),
        assetDataFactory(2, {
          _uuid: 'uuid-2',
          _supplementalDetails: {
            audio_question: {
              transcript: { languageCode: 'en', value: null },
            },
          },
        }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(true)
      expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1', 'uuid-2'])
    })

    it('should check correct field xpath', () => {
      const mockSubmissions = [
        assetDataFactory(1, {
          _uuid: 'uuid-1',
          _supplementalDetails: {
            different_question: {
              transcript: { languageCode: 'en', value: 'Hello world' },
            },
          },
        }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(true)
      expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
    })

    it('should skip submissions already filtered by previous evaluators', () => {
      const mockSubmissions = [assetDataFactory(1, { _uuid: 'uuid-1' }), assetDataFactory(2, { _uuid: 'uuid-2' })]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
        previouslyFilteredSubmissionUuids: new Set(['uuid-1']),
      }

      const result = evaluateNoSource(context)

      expect(result.shouldShow).to.equal(true)
      expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
      expect(result.computedValues.count).to.equal(1)
    })
  })
})
