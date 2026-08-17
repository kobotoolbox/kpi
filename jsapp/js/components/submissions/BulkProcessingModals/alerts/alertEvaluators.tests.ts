import { expect } from 'chai'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import { getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock } from '#/api/react-query/survey-data/msw'
import assetDataFactory from '#/endpoints/assetData.factory'
import { asrExceeded, asrNearLimit, mtExceeded, mtNearLimit, withinLimits } from '#/endpoints/serviceUsage.factory'
import {
  evaluateAlreadyApproved,
  evaluateAlreadyTranscribed,
  evaluateAlreadyTranslated,
  evaluateConflictingJob,
  evaluateNearLimit,
  evaluateNoEligibleSubmissions,
  evaluateNoSource,
  evaluateReachedLimit,
} from './alertEvaluators'
import type { AlertEvaluationContext } from './types'

function bulkActionFactory(
  uid: string,
  language: string,
  overrides: Partial<BulkActionResponse> = {},
): BulkActionResponse {
  const mock = getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
    uid,
    params: { language },
    ...overrides,
  })

  // The generated mock randomizes `submission_statuses`, which would make tests
  // pass or fail at random. Default them to the job status instead, and let a
  // test override them when it cares about a specific submission.
  if (!overrides.submission_statuses) {
    // Every job status has a submission status of the same name, so we can just
    // look it up.
    const submissionStatus = BulkActionSubmissionStatusResponseStatusEnum[mock.status]

    mock.submission_statuses = mock.submission_uuids.map((submissionUuid) => {
      return { uuid: submissionUuid, status: submissionStatus, error: null }
    })
  }

  return mock
}

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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('error')
    expect(result?.filteredSubmissionUuids).to.deep.equal([])
    expect(result?.computedValues).to.deep.equal({
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

    expect(result).to.equal(null)
  })

  it('should not show alert when no submissions are filtered', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      previouslyFilteredSubmissionUuids: new Set(),
    }

    const result = evaluateNoEligibleSubmissions(context)

    expect(result).to.equal(null)
  })

  it('should handle empty submissions array', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: [],
      previouslyFilteredSubmissionUuids: new Set(),
    }

    const result = evaluateNoEligibleSubmissions(context)

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('error')
    expect(result?.computedValues).to.deep.equal({
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

    expect(result).to.equal(null)
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

    expect(result).to.equal(null)
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

    expect(result).to.equal(null)
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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('warning')
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1', 'uuid-2'])
    expect(result?.computedValues).to.deep.equal({
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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('warning')
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-3'])
    expect(result?.computedValues.count).to.equal(1)
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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('warning')
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
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

    expect(result).to.equal(null)
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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('warning')
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('warning')
    expect(result?.filteredSubmissionUuids).to.have.members(['uuid-1', 'uuid-2', 'uuid-3'])
    expect(result?.computedValues).to.deep.equal({
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

    expect(result).to.equal(null)
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

    expect(result).to.equal(null)
  })

  it('should only ignore submissions that the ongoing job has not finished yet', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          // The job itself stays in progress until its last submission is done.
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['mock-uuid-1', 'mock-uuid-2', 'mock-uuid-3'],
          submission_statuses: [
            { uuid: 'mock-uuid-1', status: BulkActionSubmissionStatusResponseStatusEnum.complete, error: null },
            { uuid: 'mock-uuid-2', status: BulkActionSubmissionStatusResponseStatusEnum.failed, error: 'nope' },
            { uuid: 'mock-uuid-3', status: BulkActionSubmissionStatusResponseStatusEnum.in_progress, error: null },
          ],
        }),
      ],
      submissions: [assetDataFactory(1), assetDataFactory(2), assetDataFactory(3)],
    }

    const result = evaluateConflictingJob(context)

    expect(result).to.not.equal(null)
    expect(result?.filteredSubmissionUuids).to.deep.equal(['mock-uuid-3'])
    expect(result?.computedValues.count).to.equal(1)
  })

  it('should not show alert when the ongoing job already finished every selected submission', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['mock-uuid-1', 'other-uuid'],
          submission_statuses: [
            { uuid: 'mock-uuid-1', status: BulkActionSubmissionStatusResponseStatusEnum.complete, error: null },
            { uuid: 'other-uuid', status: BulkActionSubmissionStatusResponseStatusEnum.in_progress, error: null },
          ],
        }),
      ],
      submissions: [assetDataFactory(1)],
    }

    const result = evaluateConflictingJob(context)

    expect(result).to.equal(null)
  })

  it('should match submissions by root uuid even when it carries the default prefix', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['uuid:mock-uuid-1'],
          submission_statuses: [
            { uuid: 'uuid:mock-uuid-1', status: BulkActionSubmissionStatusResponseStatusEnum.in_progress, error: null },
          ],
        }),
      ],
      submissions: [assetDataFactory(1)],
    }

    const result = evaluateConflictingJob(context)

    expect(result).to.not.equal(null)
    expect(result?.filteredSubmissionUuids).to.deep.equal(['mock-uuid-1'])
  })

  // Matching on `_uuid` would report no conflict here and let a second job start on a submission already being worked
  // on by the first one.
  it('should match an edited submission by its root uuid, not its current uuid', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      activeBulkActions: [
        bulkActionFactory('uuid-1', 'en', {
          status: BulkActionResponseStatusEnum.in_progress,
          question_xpath: 'audio_question',
          action_id: ActionIdEnum.automatic_google_transcription,
          submission_uuids: ['root-uuid-1'],
          submission_statuses: [
            { uuid: 'root-uuid-1', status: BulkActionSubmissionStatusResponseStatusEnum.in_progress, error: null },
          ],
        }),
      ],
      submissions: [assetDataFactory(1, { _uuid: 'edited-uuid-1', 'meta/rootUuid': 'uuid:root-uuid-1' })],
    }

    const result = evaluateConflictingJob(context)

    expect(result).to.not.equal(null)
    expect(result?.filteredSubmissionUuids).to.deep.equal(['root-uuid-1'])
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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('error')
    expect(result?.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should not show alert when transcription quota is not exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: withinLimits(),
    }

    const result = evaluateReachedLimit(context)

    expect(result).to.equal(null)
  })

  it('should show alert when translation quota is exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      serviceUsageData: mtExceeded(),
    }

    const result = evaluateReachedLimit(context)

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('error')
    expect(result?.filteredSubmissionUuids).to.deep.equal([])
  })

  it('should not show alert when translation quota is not exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      serviceUsageData: withinLimits(),
    }

    const result = evaluateReachedLimit(context)

    expect(result).to.equal(null)
  })

  it('should not show alert when serviceUsageData is missing', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: undefined,
    }

    const result = evaluateReachedLimit(context)

    expect(result).to.equal(null)
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
      requiredAmount: 120,
    }

    const result = evaluateNearLimit(context)

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('error')
    expect(result?.filteredSubmissionUuids).to.deep.equal([])
    expect(result?.computedValues).to.deep.equal({
      remainingSeconds: 30,
    })
  })

  it('should not show alert when remaining amount is enough to process the full job', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: asrNearLimit(95),
      requiredAmount: 20,
    }

    const result = evaluateNearLimit(context)

    expect(result).to.equal(null)
  })

  it('should not show alert when balance is exceeded', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: asrExceeded(),
      requiredAmount: 120,
    }

    const result = evaluateNearLimit(context)

    expect(result).to.equal(null)
  })

  it('should show alert for translation when remaining characters are below required amount', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
      serviceUsageData: mtNearLimit(95),
      requiredAmount: 3000,
    }

    const result = evaluateNearLimit(context)

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('error')
    expect(result?.filteredSubmissionUuids).to.deep.equal([])
    expect(result?.computedValues).to.deep.equal({
      remainingCharacters: 2500,
    })
  })

  it('should not show alert when required amount is missing', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      serviceUsageData: asrNearLimit(95),
      requiredAmount: undefined,
    }

    const result = evaluateNearLimit(context)

    expect(result).to.equal(null)
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

    expect(result).to.equal(null)
  })

  it('should not show alert when no submissions have translations', () => {
    const mockSubmissions = [assetDataFactory(1, { _uuid: 'uuid-1' }), assetDataFactory(2, { _uuid: 'uuid-2' })]

    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: mockSubmissions,
    }

    const result = evaluateAlreadyTranslated(context)

    expect(result).to.equal(null)
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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('warning')
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1', 'uuid-2'])
    expect(result?.computedValues).to.deep.equal({
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

    expect(result).to.not.equal(null)
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
    expect(result?.computedValues.count).to.equal(1)
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

    expect(result).to.equal(null)
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

    expect(result).to.not.equal(null)
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
    expect(result?.computedValues).to.deep.equal({
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

    expect(result).to.equal(null)
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

    expect(result).to.not.equal(null)
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
    expect(result?.computedValues).to.deep.equal({
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

    expect(result).to.equal(null)
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

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('warning')
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1', 'uuid-2'])
    expect(result?.computedValues).to.deep.equal({
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

    expect(result).to.not.equal(null)
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
    expect(result?.computedValues.count).to.equal(1)
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

    expect(result).to.not.equal(null)
    expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
    expect(result?.computedValues).to.deep.equal({
      count: 1,
      duration: 0,
    })
  })

  // The uuids an evaluator reports end up in the POST body, so reporting `_uuid` here is what got whole jobs rejected
  // with "Unknown submission UUIDs".
  it('should report the root uuid of an edited submission, not its current uuid', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: [
        assetDataFactory(1, {
          _uuid: 'edited-uuid-1',
          'meta/rootUuid': 'uuid:root-uuid-1',
          _supplementalDetails: {
            audio_question: {
              transcript: { languageCode: 'en', value: 'hello' },
            },
          },
        }),
      ],
    }

    const result = evaluateAlreadyTranscribed(context)

    expect(result?.filteredSubmissionUuids).to.deep.equal(['root-uuid-1'])
  })

  // The cast is deliberate: `SubmissionResponse` types `meta/rootUuid` as always present, but submissions old enough
  // to predate the field really do arrive without it.
  it('should fall back to the uuid of a submission that has no root uuid', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: [
        assetDataFactory(1, {
          _uuid: 'legacy-uuid-1',
          'meta/rootUuid': undefined as unknown as string,
          _supplementalDetails: {
            audio_question: {
              transcript: { languageCode: 'en', value: 'hello' },
            },
          },
        }),
      ],
    }

    const result = evaluateAlreadyTranscribed(context)

    expect(result?.filteredSubmissionUuids).to.deep.equal(['legacy-uuid-1'])
  })
})

describe('evaluateAlreadyApproved', () => {
  const questionXpath = 'audio_question'
  const transcriptColumnKey = `_supplementalDetails/${questionXpath}/transcript_en`
  const translationColumnKey = `_supplementalDetails/${questionXpath}/translation_fr`

  const baseContext: AlertEvaluationContext = {
    submissions: [],
    fieldXpath: transcriptColumnKey,
    actionType: 'approve',
    activeBulkActions: [],
    previouslyFilteredSubmissionUuids: new Set(),
  }

  const pendingTranscriptSubmission = assetDataFactory(1, {
    _uuid: 'pending-transcript-uuid',
    _supplementalDetails: {
      [questionXpath]: {
        transcript: { languageCode: 'en', pendingReview: true },
      },
    },
  })

  const approvedTranscriptSubmission = assetDataFactory(2, {
    _uuid: 'approved-transcript-uuid',
    _supplementalDetails: {
      [questionXpath]: {
        transcript: { languageCode: 'en', value: 'Hello world' },
      },
    },
  })

  const pendingTranslationSubmission = assetDataFactory(3, {
    _uuid: 'pending-translation-uuid',
    _supplementalDetails: {
      [questionXpath]: {
        translation: { fr: { languageCode: 'fr', pendingReview: true } },
      },
    },
  })

  const approvedTranslationSubmission = assetDataFactory(4, {
    _uuid: 'approved-translation-uuid',
    _supplementalDetails: {
      [questionXpath]: {
        translation: { fr: { languageCode: 'fr', value: 'Bonjour le monde' } },
      },
    },
  })

  it('should not show alert when every submission awaits approval', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: [pendingTranscriptSubmission],
    }

    const result = evaluateAlreadyApproved(context)

    expect(result).to.equal(null)
  })

  it('should filter out submissions that are already approved', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: [approvedTranscriptSubmission, pendingTranscriptSubmission],
    }

    const result = evaluateAlreadyApproved(context)

    expect(result).to.not.equal(null)
    expect(result?.type).to.equal('warning')
    expect(result?.filteredSubmissionUuids).to.deep.equal(['approved-transcript-uuid'])
    expect(result?.computedValues).to.deep.equal({ count: 1 })
  })

  it('should filter out submissions with no supplemental content at all', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: [assetDataFactory(5, { _uuid: 'no-content-uuid' })],
    }

    const result = evaluateAlreadyApproved(context)

    expect(result?.filteredSubmissionUuids).to.deep.equal(['no-content-uuid'])
  })

  it('should handle translation columns', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      fieldXpath: translationColumnKey,
      submissions: [approvedTranslationSubmission, pendingTranslationSubmission],
    }

    const result = evaluateAlreadyApproved(context)

    expect(result?.filteredSubmissionUuids).to.deep.equal(['approved-translation-uuid'])
  })

  it('should only consider the language of the given translation column', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      fieldXpath: `_supplementalDetails/${questionXpath}/translation_es`,
      submissions: [pendingTranslationSubmission],
    }

    const result = evaluateAlreadyApproved(context)

    expect(result?.filteredSubmissionUuids).to.deep.equal(['pending-translation-uuid'])
  })

  it('should skip submissions already filtered by previous evaluators', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      submissions: [approvedTranscriptSubmission, pendingTranscriptSubmission],
      previouslyFilteredSubmissionUuids: new Set(['approved-transcript-uuid']),
    }

    const result = evaluateAlreadyApproved(context)

    expect(result).to.equal(null)
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

      expect(result).to.equal(null)
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

      expect(result).to.not.equal(null)
      expect(result?.type).to.equal('warning')
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2', 'uuid-3'])
      expect(result?.computedValues.count).to.equal(2)
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

      expect(result).to.not.equal(null)
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
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

      expect(result).to.not.equal(null)
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
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

      expect(result).to.not.equal(null)
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
      expect(result?.computedValues.count).to.equal(1)
    })
  })

  describe('for translation', () => {
    // Translation always runs off a transcript column, so the xpath is a supplemental path here, not a bare question
    // name like in the transcription block above.
    const baseContext: AlertEvaluationContext = {
      submissions: [],
      fieldXpath: '_supplementalDetails/audio_question/transcript_en',
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

      expect(result).to.equal(null)
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

      expect(result).to.not.equal(null)
      expect(result?.type).to.equal('warning')
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2', 'uuid-3'])
      expect(result?.computedValues.count).to.equal(2)
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

      expect(result).to.not.equal(null)
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1', 'uuid-2'])
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

      expect(result).to.not.equal(null)
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-1'])
    })

    it('should flag submissions transcribed in another language than the column', () => {
      // The Spanish row is empty in the English column, so it has no source to translate and has to be filtered out
      // rather than blocking the whole action.
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
              transcript: { languageCode: 'es', value: 'Hola mundo' },
            },
          },
        }),
      ]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
      }

      const result = evaluateNoSource(context)

      expect(result).to.not.equal(null)
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
      expect(result?.computedValues.count).to.equal(1)
    })

    it('should skip submissions already filtered by previous evaluators', () => {
      const mockSubmissions = [assetDataFactory(1, { _uuid: 'uuid-1' }), assetDataFactory(2, { _uuid: 'uuid-2' })]

      const context: AlertEvaluationContext = {
        ...baseContext,
        submissions: mockSubmissions,
        previouslyFilteredSubmissionUuids: new Set(['uuid-1']),
      }

      const result = evaluateNoSource(context)

      expect(result).to.not.equal(null)
      expect(result?.filteredSubmissionUuids).to.deep.equal(['uuid-2'])
      expect(result?.computedValues.count).to.equal(1)
    })
  })
})
