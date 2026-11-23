import { expect } from '@jest/globals'
import { createSurvey, addRow, serialize } from '../helpers'

function makeRow() {
  const survey = createSurvey()
  const row = addRow(survey, { type: 'select_one_from_file', name: 'q' })
  return { survey, row }
}

function findRow(survey: any) {
  return serialize(survey).survey.find((r: any) => r.name === 'q')
}

describe('select_one_from_file question', () => {
  it('injects a default file value of "DEFAULT_CHOICES_FILE"', () => {
    const { survey } = makeRow()
    expect(findRow(survey).file).toBe('DEFAULT_CHOICES_FILE')
  })

})
