import { expect } from 'chai'
import assetDataFactory from '#/endpoints/assetData.factory'
import { evaluateAlreadyTranslated, evaluateNoEligibleSubmissions } from './alertEvaluators'
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

describe('evaluateAlreadyTranslated', () => {
  const baseContext: AlertEvaluationContext = {
    submissions: [],
    fieldXpath: '_supplementalDetails/audio_question/transcript_en',
    actionType: 'translation',
    selectedLanguage: 'fr',
    activeBulkActions: [],
    previouslyFilteredSubmissionUuids: new Set(),
  }

  it('should not show alert when no language is selected', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: 'Bonjour le monde' },
            },
          },
        },
      }),
    ]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
      selectedLanguage: undefined,
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
  })

  it('should not show alert when no submissions have translations', () => {
    const mockSubmissions = [assetDataFactory(1, { _uuid: 'uuid-1' }), assetDataFactory(2, { _uuid: 'uuid-2' })]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should show alert when submissions have existing translations', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: 'Bonjour' },
            },
          },
        },
      }),
      assetDataFactory(2, {
        _uuid: 'uuid-2',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: 'Au revoir' },
            },
          },
        },
      }),
      assetDataFactory(3, { _uuid: 'uuid-3' }),
    ]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1', 'uuid-2'])
    expect(result.computedValues).to.deep.equal({
      count: 2,
      characters: 7 + 9, // 'Bonjour' + 'Au revoir'
    })
  })

  it('should not flag submissions with translations in different language', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            translation: {
              es: { languageCode: 'es', value: 'Hola' },
            },
          },
        },
      }),
      assetDataFactory(2, {
        _uuid: 'uuid-2',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: 'Bonjour' },
            },
          },
        },
      }),
    ]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
    expect(result.computedValues.count).to.equal(1)
  })

  it('should not flag submissions with empty translation value', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: '' },
            },
          },
        },
      }),
      assetDataFactory(2, {
        _uuid: 'uuid-2',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: null },
            },
          },
        },
      }),
    ]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should skip submissions already filtered by previous evaluators', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: 'Bonjour' },
            },
          },
        },
      }),
      assetDataFactory(2, {
        _uuid: 'uuid-2',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: 'Au revoir' },
            },
          },
        },
      }),
    ]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
      previouslyFilteredSubmissionUuids: new Set(['uuid-1']),
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
    expect(result.computedValues).to.deep.equal({
      count: 1,
      characters: 9, // Only 'Au revoir'
    })
  })

  it('should check correct field xpath', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          different_question: {
            translation: {
              fr: { languageCode: 'fr', value: 'Bonjour' },
            },
          },
        },
      }),
    ]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should work with direct field xpath (not transcript column xpath)', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            translation: {
              fr: { languageCode: 'fr', value: 'Bonjour' },
            },
          },
        },
      }),
    ]

    const context: AlertEvaluationContext = {
      ...baseContext,
      fieldXpath: 'audio_question',
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
    expect(result.computedValues).to.deep.equal({
      count: 1,
      characters: 7,
    })
  })
})
