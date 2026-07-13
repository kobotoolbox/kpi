import { expect } from 'chai'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import assetDataFactory from '#/endpoints/assetData.factory'
import { asrExceeded, asrNearLimit, mtExceeded, mtNearLimit, withinLimits } from '#/endpoints/serviceUsage.factory'
import {
  evaluateAlreadyTranscribed,
  evaluateAlreadyTranslated,
  evaluateConflictingJob,
  evaluateNearLimit,
  evaluateNoEligibleSubmissions,
  evaluateNoSource,
  evaluateReachedLimit,
} from './alertEvaluators'
import bulkActionFactory from '#/endpoints/bulkAction.factory'
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

describe('evaluateConflictingJob', () => {
  const mockSubmissions = [
    assetDataFactory(1, { _uuid: 'uuid-1' }),
    assetDataFactory(2, { _uuid: 'uuid-2' }),
    assetDataFactory(3, { _uuid: 'uuid-3' }),
  ]

  const baseContext: AlertEvaluationContext = {
    submissions: mockSubmissions,
    fieldXpath: 'audio_question',
    actionType: 'transcript',
    activeBulkActions: [],
    previouslyFilteredSubmissionUuids: new Set(),
  }

  it('should not show alert when no ongoing jobs exist', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should not show alert when ongoing jobs are for different field', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'different_question',
          action_id: ActionIdEnum.automatic_google_transcription,
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should not show alert when jobs are completed', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.complete,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should show alert for transcription when ongoing transcription job conflicts', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['uuid-1', 'uuid-2'],
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1', 'uuid-2'])
    expect(result.computedValues).to.deep.equal({
      count: 2,
      conflictingJobCount: 1,
    })
  })

  it('should show alert for transcription when pending job conflicts', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-3', 'en', {
          status: BulkActionResponseStatusEnum.pending,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['uuid-3'],
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-3'])
    expect(result.computedValues.count).to.equal(1)
  })

  it('should show alert for translation when ongoing translation job conflicts with same language', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      selectedLanguage: 'en',
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_translation,
          submission_uuids: ['uuid-1'],
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
  })

  it('should not show alert for translation when ongoing translation job is for different language', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      selectedLanguage: 'fr',
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_translation,
          submission_uuids: ['uuid-1'],
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should show alert for translation when ongoing transcription job conflicts', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      selectedLanguage: 'en',
      activeBulkActions: [
        bulkActionFactory('uuid-2', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['uuid-2'],
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
  })

  it('should handle multiple conflicting jobs', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['uuid-1'],
        }),
        bulkActionFactory('uuid-2', 'fr', {
          status: BulkActionResponseStatusEnum.pending,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['uuid-2', 'uuid-3'],
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.have.members(['uuid-1', 'uuid-2', 'uuid-3'])
    expect(result.computedValues).to.deep.equal({
      count: 3,
      conflictingJobCount: 2,
    })
  })

  it('should not show alert when no selected submissions overlap with ongoing jobs', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-other', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['uuid-other-1', 'uuid-other-2'],
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should not show alert for translation when ongoing translation job is for different field', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      selectedLanguage: 'en',
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'different_question',
          action_id: ActionIdEnum.automatic_google_translation,
          submission_uuids: ['uuid-1'],
        }),
      ],
    }

    const result = evaluateConflictingJob(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })
})

describe('evaluateReachedLimit', () => {
  const mockSubmissions = [assetDataFactory(1, { _uuid: 'uuid-1' }), assetDataFactory(2, { _uuid: 'uuid-2' })]

  const baseContext: AlertEvaluationContext = {
    submissions: mockSubmissions,
    fieldXpath: 'audio_question',
    actionType: 'transcript',
    activeBulkActions: [],
    previouslyFilteredSubmissionUuids: new Set(),
  }

  it('should show alert when transcription quota is exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: asrExceeded(),
    }

    const result = evaluateReachedLimit(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('error')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should not show alert when transcription quota is not exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: withinLimits(),
    }

    const result = evaluateReachedLimit(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('error')
  })

  it('should show alert when translation quota is exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      serviceUsageData: mtExceeded(),
    }

    const result = evaluateReachedLimit(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('error')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should not show alert when translation quota is not exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      serviceUsageData: withinLimits(),
    }

    const result = evaluateReachedLimit(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('error')
  })

  it('should not show alert when serviceUsageData is missing', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: undefined,
    }

    const result = evaluateReachedLimit(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('error')
  })
})

describe('evaluateNearLimit', () => {
  const mockSubmissions = [assetDataFactory(1, { _uuid: 'uuid-1' }), assetDataFactory(2, { _uuid: 'uuid-2' })]

  const baseContext: AlertEvaluationContext = {
    submissions: mockSubmissions,
    fieldXpath: 'audio_question',
    actionType: 'transcript',
    activeBulkActions: [],
    previouslyFilteredSubmissionUuids: new Set(),
  }

  it('should show alert for transcription when remaining balance is positive but below required amount', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: asrNearLimit(95),
      nearLimitRequiredAmount: 120,
    }

    const result = evaluateNearLimit(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('error')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
    expect(result.computedValues).to.deep.equal({
      remainingSeconds: 30,
    })
  })

  it('should not show alert when remaining amount is enough to process the full job', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: asrNearLimit(95),
      nearLimitRequiredAmount: 20,
    }

    const result = evaluateNearLimit(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('error')
  })

  it('should not show alert when balance is exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: asrExceeded(),
      nearLimitRequiredAmount: 120,
    }

    const result = evaluateNearLimit(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('error')
  })

  it('should show alert for translation when remaining characters are below required amount', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      serviceUsageData: mtNearLimit(95),
      nearLimitRequiredAmount: 3000,
    }

    const result = evaluateNearLimit(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('error')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
    expect(result.computedValues).to.deep.equal({
      remainingCharacters: 2500,
    })
  })

  it('should not show alert when required amount is missing', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: asrNearLimit(95),
      nearLimitRequiredAmount: undefined,
    }

    const result = evaluateNearLimit(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('error')
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

describe('evaluateAlreadyTranscribed', () => {
  const baseContext: AlertEvaluationContext = {
    submissions: [],
    fieldXpath: '_supplementalDetails/audio_question/transcript_en',
    actionType: 'transcript',
    activeBulkActions: [],
    previouslyFilteredSubmissionUuids: new Set(),
  }

  it('should not show alert when no submissions have transcripts', () => {
    const mockSubmissions = [assetDataFactory(1, { _uuid: 'uuid-1' }), assetDataFactory(2, { _uuid: 'uuid-2' })]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranscribed(context)

    expect(result.shouldShow).to.equal(false)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal([])
    expect(result.computedValues).to.deep.equal({
      count: 0,
      duration: 0,
    })
  })

  it('should show alert when submissions have existing transcripts in any language', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            transcript: {
              languageCode: 'fr',
              value: 'Bonjour',
            },
          },
        },
      }),
      assetDataFactory(2, {
        _uuid: 'uuid-2',
        _supplementalDetails: {
          audio_question: {
            transcript: {
              languageCode: 'sw',
              value: 'Habari',
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

    const result = evaluateAlreadyTranscribed(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.type).to.equal('warning')
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1', 'uuid-2'])
    expect(result.computedValues).to.deep.equal({
      count: 2,
      duration: 0,
    })
  })

  it('should treat pending-review transcripts as existing', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            transcript: {
              languageCode: 'en',
              pendingReview: true,
            },
          },
        },
      }),
    ]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranscribed(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
    expect(result.computedValues.count).to.equal(1)
  })

  it('should skip submissions already filtered by previous evaluators', () => {
    const mockSubmissions = [
      assetDataFactory(1, {
        _uuid: 'uuid-1',
        _supplementalDetails: {
          audio_question: {
            transcript: {
              languageCode: 'en',
              value: 'hello',
            },
          },
        },
      }),
      assetDataFactory(2, {
        _uuid: 'uuid-2',
        _supplementalDetails: {
          audio_question: {
            transcript: {
              languageCode: 'es',
              value: 'hola',
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

    const result = evaluateAlreadyTranscribed(context)

    expect(result.shouldShow).to.equal(true)
    expect(result.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
    expect(result.computedValues).to.deep.equal({
      count: 1,
      duration: 0,
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
