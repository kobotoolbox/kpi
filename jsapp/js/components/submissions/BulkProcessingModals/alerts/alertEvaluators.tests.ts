import { expect } from 'chai'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import assetDataFactory from '#/endpoints/assetData.factory'
import bulkActionFactory from '#/endpoints/bulkAction.factory'
import { evaluateConflictingJob, evaluateNoEligibleSubmissions } from './alertEvaluators'
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

  it('should show alert for translation when ongoing translation job conflicts', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
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

  it('should show alert for translation when ongoing transcription job conflicts', () => {
    const context: AlertEvaluationContext = {
      ...baseContext,
      actionType: 'translation',
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
