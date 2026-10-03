import { expect } from '@jest/globals'
import { createSurvey, serialize, addRow } from '../helpers'

function createSurveyWithSelect() {
  const survey = createSurvey()
  // "select_one colors" is xlform's internal concatenated format — the API sends
  // type and select_from_list_name as separate fields already
  const list = survey.choices.create()
  list.set('name', 'colors')
  list.options.add({ label: 'Red' })
  list.options.add({ label: 'Blue' })
  addRow(survey, { type: 'select_one colors', name: 'fav_color', select_from_list_name: 'colors' })
  return survey
}

function findRow(output: Record<string, any>) {
  return output.survey.find((r: any) => r.name === 'fav_color')
}

describe('select_one question', () => {
  it('splits the internal "select_one colors" representation into separate type and select_from_list_name fields', () => {
    const row = findRow(serialize(createSurveyWithSelect()))
    expect(row.type).toBe('select_one')
    expect(row.select_from_list_name).toBe('colors')
  })

  it('choices appear in the choices array with the correct list_name', () => {
    const output = serialize(createSurveyWithSelect())
    const choices = output.choices.filter((c: any) => c.list_name === 'colors')
    expect(choices).toHaveLength(2)
  })

  it('each choice has a label and auto-generated name', () => {
    const output = serialize(createSurveyWithSelect())
    const choices = output.choices.filter((c: any) => c.list_name === 'colors')
    expect(choices.map((c: any) => c.label)).toEqual(['Red', 'Blue'])
    expect(choices.map((c: any) => c.name)).toEqual(['red', 'blue'])
  })

  it('choice labels reflect edits made after creation', () => {
    const survey = createSurvey()
    const list = survey.choices.create()
    list.set('name', 'colors')
    list.options.add({ label: 'Red' })
    addRow(survey, { type: 'select_one colors', select_from_list_name: 'colors' })

    list.options.last().set('label', 'Crimson')

    const output = serialize(survey)
    const choices = output.choices.filter((c: any) => c.list_name === 'colors')
    expect(choices[0].label).toBe('Crimson')
  })
})
