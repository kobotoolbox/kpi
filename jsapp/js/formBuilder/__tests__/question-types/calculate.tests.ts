import { expect } from '@jest/globals'
import { createSurvey, serialize, addRow } from '../helpers'

function makeRow() {
  const survey = createSurvey()
  const row = addRow(survey, { type: 'calculate', name: 'age_doubled' })
  return { survey, row }
}

function findRow(survey: any) {
  return serialize(survey).survey.find((r: any) => r.name === 'age_doubled')
}

describe('calculate question', () => {
  it('expression is stored in calculation; label defaults to "calculation"', () => {
    const { survey, row } = makeRow()
    row.setDetail('calculation', '${age} * 2')
    const output = findRow(survey)
    expect(output.calculation).toBe('${age} * 2')
    expect(output.label).toBe('calculation')
  })

  it('required is "false" by default', () => {
    // _hideUnlessChanged suppresses the field in the UI, but it still serializes
    const { survey } = makeRow()
    expect(findRow(survey).required).toBe('false')
  })
})
