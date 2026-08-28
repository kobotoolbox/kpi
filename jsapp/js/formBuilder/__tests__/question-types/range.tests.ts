import { expect } from '@jest/globals'
import { createSurvey, addRow, serialize } from '../helpers'

function makeRow() {
  const survey = createSurvey()
  const row = addRow(survey, { type: 'range', name: 'score' })
  return { survey, row }
}

function findRow(survey: any) {
  return serialize(survey).survey.find((r: any) => r.name === 'score')
}

describe('range question', () => {
  // config defines start=0/end=10/step=1 as defaults but they are UI-only —
  // parameters are omitted from output until the user explicitly sets them
  it('parameters are absent by default', () => {
    const { survey } = makeRow()
    expect(findRow(survey).parameters).toBeUndefined()
  })

  it('serializes parameters as a semicolon-delimited key=value string', () => {
    const { survey, row } = makeRow()
    row.setParameters({ start: 1, end: 5, step: 0.5 })
    expect(findRow(survey).parameters).toBe('start=1;end=5;step=0.5')
  })
})
