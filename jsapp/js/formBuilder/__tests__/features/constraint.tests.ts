import { expect } from '@jest/globals'
import { createSurvey, addRow, serialize } from '../helpers'

function makeRow() {
  const survey = createSurvey()
  const row = addRow(survey, { type: 'integer', name: 'age' })
  return { survey, row }
}

function findRow(survey: any) {
  return serialize(survey).survey.find((r: any) => r.name === 'age')
}

describe('constraint', () => {
  // constraint_message is a sibling field, not nested inside constraint
  it('constraint and constraint_message serialize as separate top-level fields', () => {
    const { survey, row } = makeRow()
    row.setDetail('constraint', '. > 0')
    row.setDetail('constraint_message', 'Must be positive')
    const out = findRow(survey)
    expect(out.constraint).toBe('. > 0')
    expect(out.constraint_message).toBe('Must be positive')
  })
})
