import { expect } from '@jest/globals'
import type { AssetContent } from '#/dataInterface'
import {
  loadSurvey,
  serialize,
  addRow,
  findRowByAutoname,
  setLabel,
} from '../helpers'
import translatedForm from '../fixtures/translated-form.json'

// These tests exercise editing behavior in multi-language forms.
// The translated fixture has English (en), French (fr), and Turkish (tr).
// After nullifyTranslations on load, the default language (English) is bare
// `label` and others are `label::French (fr)` etc.

function loadTranslated() {
  return loadSurvey(translatedForm.content as unknown as AssetContent)
}

function getLangLabel(output: Record<string, any>, autoname: string, lang: string): string | undefined {
  const row = output.survey.find((r: any) => r.$autoname === autoname)
  return row?.[`label::${lang}`]
}

// ---------------------------------------------------------------------------
// Editing a non-default language label
// ---------------------------------------------------------------------------

describe('translations — editing non-default language labels', () => {
  it('can set a French label via label::French (fr)', () => {
    const survey = loadTranslated()
    const row = findRowByAutoname(survey, 'Pick_a_color')
    row.get('label::French (fr)').set('value', 'Choisir une couleur')
    const output = serialize(survey)
    expect(getLangLabel(output, 'Pick_a_color', 'French (fr)')).toBe('Choisir une couleur')
  })

  it('editing French does not affect English or Turkish', () => {
    const survey = loadTranslated()
    const row = findRowByAutoname(survey, 'Pick_a_color')
    row.get('label::French (fr)').set('value', 'Modifié')
    const output = serialize(survey)
    expect(getLangLabel(output, 'Pick_a_color', 'English (en)')).toBe('Pick a color')
    expect(getLangLabel(output, 'Pick_a_color', 'Turkish (tr)')).toBe('Bir renk seçin')
  })

  it('editing the default (English) label does not affect other languages', () => {
    const survey = loadTranslated()
    const row = findRowByAutoname(survey, 'Type_a_word')
    setLabel(row, 'Enter a word')
    const output = serialize(survey)
    expect(getLangLabel(output, 'Type_a_word', 'English (en)')).toBe('Enter a word')
    expect(getLangLabel(output, 'Type_a_word', 'French (fr)')).toBe('Tapez un mot')
    expect(getLangLabel(output, 'Type_a_word', 'Turkish (tr)')).toBe('Bir kelime yazın')
  })

  it('can edit Turkish label', () => {
    const survey = loadTranslated()
    const row = findRowByAutoname(survey, 'Type_a_word')
    row.get('label::Turkish (tr)').set('value', 'Kelime girin')
    const output = serialize(survey)
    expect(getLangLabel(output, 'Type_a_word', 'Turkish (tr)')).toBe('Kelime girin')
    expect(getLangLabel(output, 'Type_a_word', 'English (en)')).toBe('Type a word')
    expect(getLangLabel(output, 'Type_a_word', 'French (fr)')).toBe('Tapez un mot')
  })
})

// ---------------------------------------------------------------------------
// Adding a row in a multi-language form
// ---------------------------------------------------------------------------

describe('translations — adding rows to a translated form', () => {
  it('new row default label is emitted under the default language key', () => {
    const survey = loadTranslated()
    addRow(survey, { type: 'decimal' })
    const output = serialize(survey)
    const decRow = output.survey.find((r: any) => r.type === 'decimal')
    // unnullifyTranslations converts bare `label` → `label::English (en)`
    expect(decRow['label::English (en)']).toBe('Enter a number')
  })

  it('new row does NOT get non-default language labels automatically', () => {
    const survey = loadTranslated()
    addRow(survey, { type: 'decimal' })
    const output = serialize(survey)
    const decRow = output.survey.find((r: any) => r.type === 'decimal')
    // xlform does not create label::French or label::Turkish on new rows
    expect(decRow['label::French (fr)']).toBeUndefined()
    expect(decRow['label::Turkish (tr)']).toBeUndefined()
  })

  it('non-default language details do not exist on new rows in memory', () => {
    const survey = loadTranslated()
    const newRow = addRow(survey, { type: 'decimal' })
    // The RowDetail for non-default languages is simply not created
    expect(newRow.get('label::French (fr)')).toBeUndefined()
    expect(newRow.get('label::Turkish (tr)')).toBeUndefined()
  })

  it('can add a non-default language label to a new row via setDetail', () => {
    const survey = loadTranslated()
    const newRow = addRow(survey, { type: 'decimal' })
    // setDetail creates the RowDetail if it doesn't exist
    newRow.setDetail('label::French (fr)', 'Entrez un nombre')
    const output = serialize(survey)
    const decRow = output.survey.find((r: any) => r.type === 'decimal')
    expect(decRow['label::French (fr)']).toBe('Entrez un nombre')
  })

  it('adding a row does not corrupt existing translated rows', () => {
    const survey = loadTranslated()
    addRow(survey, { type: 'text' })
    const output = serialize(survey)
    expect(getLangLabel(output, 'Pick_a_color', 'English (en)')).toBe('Pick a color')
    expect(getLangLabel(output, 'Pick_a_color', 'French (fr)')).toBe('Choisissez une couleur')
    expect(getLangLabel(output, 'Pick_a_color', 'Turkish (tr)')).toBe('Bir renk seçin')
  })
})
