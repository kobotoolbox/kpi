import { expect } from '@jest/globals'
import type { AssetContent } from '#/dataInterface'
import {
  loadSurvey,
  serialize,
  addRow,
  findRowByAutoname,
  setLabel,
} from '../helpers'
import structuralNestingForm from '../fixtures/structural-nesting-form.json'
import translatedForm from '../fixtures/translated-form.json'

// These tests exercise the mutation path: load a form, make changes, serialize.
//
// In both fixtures, question rows have $autoname but not name (name is promoted
// from $autoname by the backend at snapshot time, not on save).
//
// The serialized output for translated forms uses label::LangName column syntax,
// not positional arrays. The backend's expand_content step converts to positional
// arrays — that does not run in these tests.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadStructural() {
  return loadSurvey(structuralNestingForm.content as unknown as AssetContent)
}

function loadTranslated() {
  return loadSurvey(translatedForm.content as unknown as AssetContent)
}

function userRows(output: Record<string, any>) {
  return output.survey.filter(
    (r: any) => !['start', 'end'].includes(r.type)
  )
}

// ---------------------------------------------------------------------------
// Adding rows
// ---------------------------------------------------------------------------

describe('editing — add rows', () => {
  it('new question appears in serialized output alongside existing rows', () => {
    const survey = loadStructural()
    addRow(survey, { type: 'text' })
    const output = serialize(survey)
    const autonames = output.survey.map((r: any) => r.$autoname)
    // Existing rows survive
    expect(autonames).toContain('Type_a_word')
    expect(autonames).toContain('Pick_a_food')
    // New row is present (text has no default label so autoname will be undefined,
    // but it should add a row of type text)
    const textRows = output.survey.filter((r: any) => r.type === 'text')
    expect(textRows.length).toBeGreaterThan(1) // fixture already has one text row
  })

  it('new question is appended at the end (after groups/repeats)', () => {
    const survey = loadStructural()
    addRow(survey, { type: 'integer' })
    const rows = userRows(serialize(survey))
    const lastUserRow = rows[rows.length - 1]
    expect(lastUserRow.type).toBe('integer')
    expect(lastUserRow.label).toBe('Enter a number') // defaultsForType
  })

  it('new question can be inserted after a specific row', () => {
    const survey = loadStructural()
    const target = findRowByAutoname(survey, 'Type_a_word')
    survey.addRow({ type: 'decimal', name: 'inserted' }, { after: target })
    const output = serialize(survey)
    const rows = userRows(output)
    const autonames = rows.map((r: any) => r.$autoname)
    const typeAWordIdx = autonames.indexOf('Type_a_word')
    // The inserted row should be immediately after Type_a_word
    expect(rows[typeAWordIdx + 1].name).toBe('inserted')
  })
})

// ---------------------------------------------------------------------------
// Changing labels
// ---------------------------------------------------------------------------

describe('editing — change labels', () => {
  it('changed label appears in serialized output', () => {
    const survey = loadStructural()
    const row = findRowByAutoname(survey, 'Type_a_word')
    setLabel(row, 'What is your name?')
    const output = serialize(survey)
    const serialized = output.survey.find((r: any) => r.$autoname === 'Type_a_word')
    expect(serialized.label).toBe('What is your name?')
  })

  it('changing one label does not affect siblings', () => {
    const survey = loadStructural()
    setLabel(findRowByAutoname(survey, 'Type_a_word'), 'Changed')
    const output = serialize(survey)
    const sibling = output.survey.find((r: any) => r.$autoname === 'Pick_a_food')
    expect(sibling.label).toBe('Pick a food')
  })

  it('changing one label does not affect rows in other groups', () => {
    const survey = loadStructural()
    setLabel(findRowByAutoname(survey, 'Type_a_word'), 'Changed')
    const output = serialize(survey)
    const other = output.survey.find((r: any) => r.$autoname === 'Pick_a_protein')
    expect(other.label).toBe('Pick a protein')
  })
})

// ---------------------------------------------------------------------------
// Deleting rows
// ---------------------------------------------------------------------------

describe('editing — delete rows', () => {
  it('detached row disappears from output', () => {
    const survey = loadStructural()
    findRowByAutoname(survey, 'Type_a_word').detach()
    const output = serialize(survey)
    const autonames = output.survey.map((r: any) => r.$autoname)
    expect(autonames).not.toContain('Type_a_word')
  })

  it('siblings of deleted row remain', () => {
    const survey = loadStructural()
    findRowByAutoname(survey, 'Type_a_word').detach()
    const output = serialize(survey)
    const autonames = output.survey.map((r: any) => r.$autoname)
    expect(autonames).toContain('Pick_a_food')
  })

  it('group structure is preserved when a child is deleted', () => {
    const survey = loadStructural()
    findRowByAutoname(survey, 'Type_a_word').detach()
    const output = serialize(survey)
    // The group itself still exists
    const beginGroup = output.survey.find((r: any) => r.type === 'begin_group')
    const endGroup = output.survey.find((r: any) => r.type === 'end_group')
    expect(beginGroup).toBeDefined()
    expect(endGroup).toBeDefined()
    expect(endGroup.$kuid).toBe('/' + beginGroup.$kuid)
  })
})

// ---------------------------------------------------------------------------
// Moving rows (reordering)
// ---------------------------------------------------------------------------

describe('editing — move rows', () => {
  it('move a row to a different position within the same parent', () => {
    const survey = loadStructural()
    // Move Pick_a_food before Type_a_word (both in group_oc7df70)
    const pickFood = findRowByAutoname(survey, 'Pick_a_food')
    // Since Type_a_word is first in the group, inserting at index 0 puts Pick_a_food first
    const group = findRowByAutoname(survey, 'group_oc7df70')
    survey._insertRowInPlace(pickFood, { parent: group, index: 0 })

    const output = serialize(survey)
    const rows = userRows(output)
    const groupStart = rows.findIndex((r: any) => r.type === 'begin_group')
    // First child after begin_group should now be Pick_a_food
    expect(rows[groupStart + 1].$autoname).toBe('Pick_a_food')
    expect(rows[groupStart + 2].$autoname).toBe('Type_a_word')
  })

  it('move a row into a group from outside', () => {
    const survey = loadStructural()
    // Pick_a_color is at the top level; move it into the group
    const pickColor = findRowByAutoname(survey, 'Pick_a_color')
    const group = findRowByAutoname(survey, 'group_oc7df70')
    survey._insertRowInPlace(pickColor, { parent: group, index: 0 })

    const output = serialize(survey)
    const rows = userRows(output)
    const groupStart = rows.findIndex((r: any) => r.type === 'begin_group')
    const groupEnd = rows.findIndex((r: any) => r.type === 'end_group')
    const insideGroup = rows.slice(groupStart + 1, groupEnd)
    const autonames = insideGroup.map((r: any) => r.$autoname)
    expect(autonames).toContain('Pick_a_color')
    expect(autonames).toContain('Type_a_word')
    expect(autonames).toContain('Pick_a_food')
  })

  it('move a row out of a group to top level', () => {
    const survey = loadStructural()
    const typeWord = findRowByAutoname(survey, 'Type_a_word')
    // Move to top level at position 0
    survey._insertRowInPlace(typeWord, { index: 0 })

    const output = serialize(survey)
    const rows = userRows(output)
    // First user row should be our moved row
    expect(rows[0].$autoname).toBe('Type_a_word')
    // It should no longer be between begin_group and end_group
    const groupStart = rows.findIndex((r: any) => r.type === 'begin_group')
    const groupEnd = rows.findIndex((r: any) => r.type === 'end_group')
    const insideGroup = rows.slice(groupStart + 1, groupEnd)
    expect(insideGroup.map((r: any) => r.$autoname)).not.toContain('Type_a_word')
  })
})

// ---------------------------------------------------------------------------
// Grouping and ungrouping
// ---------------------------------------------------------------------------

describe('editing — group operations', () => {
  it('wrap existing rows in a new group', () => {
    const survey = loadStructural()
    const pickColor = findRowByAutoname(survey, 'Pick_a_color')
    survey._addGroup({ label: 'New Group', __rows: [pickColor] })

    const output = serialize(survey)
    // There should now be two begin_group rows
    const groups = output.survey.filter((r: any) => r.type === 'begin_group')
    expect(groups.length).toBe(2)
    // One of them should have label 'New Group'
    expect(groups.map((g: any) => g.label)).toContain('New Group')
  })

  it('splitApart dissolves a group, leaving children in place', () => {
    const survey = loadStructural()
    const group = findRowByAutoname(survey, 'group_oc7df70')
    group.splitApart()

    const output = serialize(survey)
    // No more begin_group (the only group in the fixture is gone)
    const groups = output.survey.filter((r: any) => r.type === 'begin_group')
    expect(groups.length).toBe(0)
    // But the children are still present at top level
    const autonames = output.survey.map((r: any) => r.$autoname)
    expect(autonames).toContain('Type_a_word')
    expect(autonames).toContain('Pick_a_food')
  })

  it('detaching a group removes it and all its children', () => {
    const survey = loadStructural()
    const group = findRowByAutoname(survey, 'group_oc7df70')
    group.detach()

    const output = serialize(survey)
    const autonames = output.survey.map((r: any) => r.$autoname)
    // Group and its children gone
    expect(autonames).not.toContain('group_oc7df70')
    expect(autonames).not.toContain('Type_a_word')
    expect(autonames).not.toContain('Pick_a_food')
    // Other rows survive
    expect(autonames).toContain('Pick_a_color')
    expect(autonames).toContain('Pick_a_protein')
  })
})

// ---------------------------------------------------------------------------
// Choice list editing
// ---------------------------------------------------------------------------

describe('editing — choices', () => {
  it('adding a choice to an existing list shows up in serialized output', () => {
    const survey = loadStructural()
    // The fixture has a list used by Pick_a_color with choices blue, green, red
    const colorList = survey.choices.find(
      (list: any) => list.get('name') === 'os1nu74'
    )
    colorList.options.add({ label: 'Yellow' })

    const output = serialize(survey)
    const colorChoices = output.choices.filter(
      (c: any) => c.list_name === 'os1nu74'
    )
    expect(colorChoices.map((c: any) => c.label)).toContain('Yellow')
    expect(colorChoices.length).toBe(4)
  })

  it('renaming a choice label is reflected in output', () => {
    const survey = loadStructural()
    const colorList = survey.choices.find(
      (list: any) => list.get('name') === 'os1nu74'
    )
    const blueOption = colorList.options.find(
      (opt: any) => opt.get('name') === 'blue'
    )
    blueOption.set('label', 'Azure')

    const output = serialize(survey)
    const blue = output.choices.find(
      (c: any) => c.list_name === 'os1nu74' && c.name === 'blue'
    )
    expect(blue.label).toBe('Azure')
  })
})

// ---------------------------------------------------------------------------
// Translation preservation
// ---------------------------------------------------------------------------

describe('editing — translations preserved after mutations', () => {
  it('adding a row does not corrupt existing translated labels', () => {
    const survey = loadTranslated()
    addRow(survey, { type: 'text' })
    const output = serialize(survey)
    const colorRow = output.survey.find((r: any) => r.$autoname === 'Pick_a_color')
    expect(colorRow['label::English (en)']).toBe('Pick a color')
    expect(colorRow['label::French (fr)']).toBe('Choisissez une couleur')
    expect(colorRow['label::Turkish (tr)']).toBe('Bir renk seçin')
  })

  it('changing the default-language label preserves other translations', () => {
    const survey = loadTranslated()
    const row = findRowByAutoname(survey, 'Type_a_word')
    setLabel(row, 'Updated English label')
    const output = serialize(survey)
    const serialized = output.survey.find((r: any) => r.$autoname === 'Type_a_word')
    expect(serialized['label::English (en)']).toBe('Updated English label')
    expect(serialized['label::French (fr)']).toBe('Tapez un mot')
    expect(serialized['label::Turkish (tr)']).toBe('Bir kelime yazın')
  })

  it('deleting a row does not corrupt translations on remaining rows', () => {
    const survey = loadTranslated()
    findRowByAutoname(survey, 'Type_a_word').detach()
    const output = serialize(survey)
    const colorRow = output.survey.find((r: any) => r.$autoname === 'Pick_a_color')
    expect(colorRow['label::English (en)']).toBe('Pick a color')
    expect(colorRow['label::French (fr)']).toBe('Choisissez une couleur')
    expect(colorRow['label::Turkish (tr)']).toBe('Bir renk seçin')
  })
})
