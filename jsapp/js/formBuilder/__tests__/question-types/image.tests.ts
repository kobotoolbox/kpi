import { expect } from '@jest/globals'
import { createSurvey, addRow, serialize } from '../helpers'

function makeRow() {
  const survey = createSurvey()
  const row = addRow(survey, { type: 'image', name: 'photo' })
  return { survey, row }
}

function findRow(survey: any) {
  return serialize(survey).survey.find((r: any) => r.name === 'photo')
}

describe('image question', () => {
  it('has a type-specific default label', () => {
    const { survey } = makeRow()
    expect(findRow(survey).label).toBe('Point and shoot! Use the camera to take a photo')
  })

  it('parameters are absent by default', () => {
    const { survey } = makeRow()
    expect(findRow(survey).parameters).toBeUndefined()
  })

  it('serializes max-pixels as a key=value string', () => {
    const { survey, row } = makeRow()
    row.setParameters({ 'max-pixels': 1024 })
    expect(findRow(survey).parameters).toBe('max-pixels=1024')
  })
})
