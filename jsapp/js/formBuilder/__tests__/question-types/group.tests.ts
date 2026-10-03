import { expect } from '@jest/globals'
import { createSurvey, addRow, serialize } from '../helpers'

function makeGroup() {
  const survey = createSurvey()
  addRow(survey, { type: 'group' })
  const out = serialize(survey)
  return {
    begin: out.survey.find((r: any) => r.type === 'begin_group'),
    end: out.survey.find((r: any) => r.type === 'end_group'),
  }
}

describe('group', () => {
  it('a single group emits a begin_group and end_group pair', () => {
    const { begin, end } = makeGroup()
    expect(begin).toBeDefined()
    expect(end).toBeDefined()
  })

  it('end_group.$kuid is "/" + begin_group.$kuid', () => {
    const { begin, end } = makeGroup()
    expect(end.$kuid).toBe(`/${begin.$kuid}`)
  })

  it('emits empty string for label, relevant, and appearance', () => {
    const { begin } = makeGroup()
    expect(begin.label).toBe('')
    expect(begin.relevant).toBe('')
    expect(begin.appearance).toBe('')
  })

  // required on groups is boolean false (not string) but only when loaded from a fixture —
  // a freshly created group has no required field at all. See features/required.tests.ts.
})
