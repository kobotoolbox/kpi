import { expect } from '@jest/globals'
import { createSurvey, addRow, serialize } from '../helpers'

function defaultLabel(type: string) {
  const survey = createSurvey()
  addRow(survey, { type, name: 'q' })
  return serialize(survey).survey.find((r: any) => r.name === 'q').label
}

/**
 * These types ship with a default label from configs.defaultsForType.
 * The label is written to the row by the model on creation — contrast with
 * text, whose "New Question" placeholder is injected by the view and never
 * reaches the serialized output.
 */
describe('type-specific default labels', () => {
  it.each([
    ['note',      'This note can be read out loud'],
    ['integer',   'Enter a number'],
    ['decimal',   'Enter a number'],
    ['date',      'Enter a date'],
    ['time',      'Enter a time'],
    ['datetime',  'Enter a date and time'],
    ['geopoint',  'Record your current location'],
    ['geotrace',  'Record a line'],
    ['geoshape',  'Record an area'],
    ['barcode',   'Use the camera to scan a barcode'],
    ['image',     'Point and shoot! Use the camera to take a photo'],
    ['audio',     "Use the camera's microphone to record a sound"],
    ['video',     'Use the camera to record a video'],
    ['acknowledge', 'Acknowledge'],
    ['calculate', 'calculation'],
    ['hidden',    'hidden'],
  ])('%s has default label "%s"', (type, expected) => {
    expect(defaultLabel(type)).toBe(expected)
  })
})
