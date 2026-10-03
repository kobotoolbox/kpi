import { expect } from '@jest/globals'
import type { AssetContent } from '#/dataInterface'
import { createSurvey, serialize, addRow } from '../helpers'
import { XlformAdapter } from '../../adapter'
import structuralNestingForm from '../fixtures/structural-nesting-form.json'

/**
 * `required` behaves differently on question rows vs group rows.
 * See SERIALIZATION_QUIRKS.md for context.
 */
describe('required field serialization', () => {
  describe('on question rows', () => {
    it('is the string "false" by default', () => {
      const survey = createSurvey()
      addRow(survey, { type: 'text', name: 'q' })
      const row = serialize(survey).survey.find((r: any) => r.name === 'q')
      expect(row.required).toBe('false')
    })

    it('is the string "true" when enabled', () => {
      const survey = createSurvey()
      const row = addRow(survey, { type: 'text', name: 'q' })
      row.setDetail('required', true)
      const output = serialize(survey).survey.find((r: any) => r.name === 'q')
      expect(output.required).toBe('true')
    })
  })

  describe('on group rows (loaded from fixture)', () => {
    // Groups in the API response store required as boolean false.
    // xlform preserves this — it does not coerce it to the string "false".
    it('preserves required as boolean false, not string', () => {
      const adapter = new XlformAdapter()
      adapter.load(structuralNestingForm.content as AssetContent)
      const output = JSON.parse(adapter.serialize())
      const group = output.survey.find((r: any) => r.type === 'begin_group')
      expect(group.required).toBe(false)
    })
  })
})
