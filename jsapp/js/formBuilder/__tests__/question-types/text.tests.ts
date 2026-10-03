import { expect } from '@jest/globals'
import { createSurvey, addRow, serialize } from '../helpers'

function makeRow() {
  const survey = createSurvey()
  const row = addRow(survey, { type: 'text', name: 'your_name' })
  return { survey, row }
}

function findRow(survey: any) {
  return serialize(survey).survey.find((r: any) => r.name === 'your_name')
}

describe('text question', () => {
  it('required serializes as "false" (string) by default', () => {
    const { survey } = makeRow()
    expect(findRow(survey).required).toBe('false')
  })

  it('required serializes as "true" (string) when set to boolean true', () => {
    const { survey, row } = makeRow()
    row.setDetail('required', true)
    expect(findRow(survey).required).toBe('true')
  })
})
