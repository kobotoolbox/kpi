import { expect } from 'chai'
import assetDataFactory from '#/endpoints/assetData.factory'
import { evaluateNoEligibleSubmissions } from './alertEvaluators'
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
