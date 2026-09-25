import { expect } from '@jest/globals'
import type { AssetContent } from '#/dataInterface'
import {
  loadSurvey,
  serialize,
  addRow,
  findRowByAutoname,
  setLabel,
} from '../helpers'

// These tests document how skip logic (the `relevant` field) and validation
// logic (`constraint`) behave through the load → mutate → serialize cycle.
//
// The skip logic expression builder is view-level code (Backbone views) and
// cannot be exercised here. What we CAN test is:
// - How relevant/constraint strings survive serialization
// - How they interact with mutations (rename, delete, add)
// - The cid-based rename propagation mechanism

// ---------------------------------------------------------------------------
// Fixture: a form with skip logic expressions
// ---------------------------------------------------------------------------

const SKIP_LOGIC_FORM: AssetContent = {
  survey: [
    { type: 'integer', name: 'age', label: ['How old are you?'], $kuid: 'aaa111', $autoname: 'age', $xpath: 'age', required: false },
    { type: 'text', name: 'school', label: ['What school?'], $kuid: 'bbb222', $autoname: 'school', $xpath: 'school', relevant: '${age} < 18', required: false },
    { type: 'select_one', name: 'drink', label: ['Favorite drink?'], $kuid: 'ccc333', $autoname: 'drink', $xpath: 'drink', relevant: '${age} >= 21', select_from_list_name: 'drinks', required: false },
    { type: 'note', name: 'msg', label: ['Answered something'], $kuid: 'ddd444', $autoname: 'msg', $xpath: 'msg', relevant: "${age} != ''", required: false },
  ],
  choices: [
    { list_name: 'drinks', name: 'beer', label: ['Beer'], $kuid: 'ch1', $autovalue: 'beer' },
    { list_name: 'drinks', name: 'wine', label: ['Wine'], $kuid: 'ch2', $autovalue: 'wine' },
  ],
  settings: {},
  translations: [null],
  translated: ['label'],
} as unknown as AssetContent

function loadSkipLogicForm() {
  return loadSurvey(SKIP_LOGIC_FORM)
}

function getRelevant(output: Record<string, any>, autoname: string): string | undefined {
  const row = output.survey.find((r: any) => r.$autoname === autoname)
  return row?.relevant
}

// ---------------------------------------------------------------------------
// Round-trip preservation
// ---------------------------------------------------------------------------

describe('skip logic — round-trip preservation', () => {
  it('simple comparison expressions survive load→serialize', () => {
    const output = serialize(loadSkipLogicForm())
    expect(getRelevant(output, 'school')).toBe('${age} < 18')
    expect(getRelevant(output, 'drink')).toBe('${age} >= 21')
  })

  it('existence check expression survives load→serialize', () => {
    const output = serialize(loadSkipLogicForm())
    expect(getRelevant(output, 'msg')).toBe("${age} != ''")
  })

  it('rows without relevant do not gain one after load→serialize', () => {
    const output = serialize(loadSkipLogicForm())
    expect(getRelevant(output, 'age')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Skip logic survives unrelated mutations
// ---------------------------------------------------------------------------

describe('skip logic — survives unrelated mutations', () => {
  it('adding a new row does not corrupt existing relevant expressions', () => {
    const survey = loadSkipLogicForm()
    addRow(survey, { type: 'text' })
    const output = serialize(survey)
    expect(getRelevant(output, 'school')).toBe('${age} < 18')
    expect(getRelevant(output, 'drink')).toBe('${age} >= 21')
    expect(getRelevant(output, 'msg')).toBe("${age} != ''")
  })

  it('changing a label on a different row does not corrupt relevant', () => {
    const survey = loadSkipLogicForm()
    setLabel(findRowByAutoname(survey, 'age'), 'Your age?')
    const output = serialize(survey)
    expect(getRelevant(output, 'school')).toBe('${age} < 18')
  })

  it('deleting an unrelated row does not corrupt relevant on remaining rows', () => {
    const survey = loadSkipLogicForm()
    findRowByAutoname(survey, 'msg').detach()
    const output = serialize(survey)
    expect(getRelevant(output, 'school')).toBe('${age} < 18')
    expect(getRelevant(output, 'drink')).toBe('${age} >= 21')
  })
})

// ---------------------------------------------------------------------------
// Deleting the referenced row
// ---------------------------------------------------------------------------

describe('skip logic — deleting the referenced question', () => {
  it('deleting the only referenced question removes the relevant entirely', () => {
    const survey = loadSkipLogicForm()
    findRowByAutoname(survey, 'age').detach()
    const output = serialize(survey)
    // xlform: broken single-reference criterion → empty string → filtered by _hideUnlessChanged
    expect(getRelevant(output, 'school')).toBeUndefined()
    expect(getRelevant(output, 'drink')).toBeUndefined()
    expect(getRelevant(output, 'msg')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Multi-criteria expressions
// ---------------------------------------------------------------------------

const MULTI_CRITERIA_FORM: AssetContent = {
  survey: [
    { type: 'integer', name: 'age', label: ['Age'], $kuid: 'mc1', $autoname: 'age', $xpath: 'age', required: false },
    { type: 'integer', name: 'score', label: ['Score'], $kuid: 'mc2', $autoname: 'score', $xpath: 'score', required: false },
    { type: 'text', name: 'result', label: ['Result'], $kuid: 'mc3', $autoname: 'result', $xpath: 'result', relevant: '${age} >= 18 and ${score} > 50', required: false },
  ],
  choices: [],
  settings: {},
  translations: [null],
  translated: ['label'],
} as unknown as AssetContent

describe('skip logic — multi-criteria expressions', () => {
  it('and-joined expression survives round-trip', () => {
    const survey = loadSurvey(MULTI_CRITERIA_FORM)
    const output = serialize(survey)
    expect(getRelevant(output, 'result')).toBe('${age} >= 18 and ${score} > 50')
  })

  it('deleting one of two referenced questions drops only that criterion', () => {
    const survey = loadSurvey(MULTI_CRITERIA_FORM)
    findRowByAutoname(survey, 'score').detach()
    const output = serialize(survey)
    // xlform drops the broken criterion but keeps the surviving one
    expect(getRelevant(output, 'result')).toBe('${age} >= 18')
  })
})

// ---------------------------------------------------------------------------
// Rename propagation (cid-based reference resolution)
// ---------------------------------------------------------------------------

describe('skip logic — rename propagation', () => {
  it('renaming the referenced question updates the relevant expression', () => {
    const survey = loadSkipLogicForm()
    const ageRow = findRowByAutoname(survey, 'age')
    ageRow.get('name').set('value', 'user_age')
    const output = serialize(survey)
    expect(getRelevant(output, 'school')).toBe('${user_age} < 18')
    expect(getRelevant(output, 'drink')).toBe('${user_age} >= 21')
    expect(getRelevant(output, 'msg')).toBe("${user_age} != ''")
  })
})

// ---------------------------------------------------------------------------
// select_multiple: selected() function syntax
// ---------------------------------------------------------------------------

const SELECT_MULTIPLE_LOGIC_FORM: AssetContent = {
  survey: [
    { type: 'select_multiple', name: 'colors', label: ['Pick colors'], $kuid: 'sm1', $autoname: 'colors', $xpath: 'colors', select_from_list_name: 'color_list', required: false },
    { type: 'text', name: 'explain_blue', label: ['Why blue?'], $kuid: 'sm2', $autoname: 'explain_blue', $xpath: 'explain_blue', relevant: "selected(${colors}, 'blue')", required: false },
    { type: 'text', name: 'not_red', label: ['Not red note'], $kuid: 'sm3', $autoname: 'not_red', $xpath: 'not_red', relevant: "not(selected(${colors}, 'red'))", required: false },
  ],
  choices: [
    { list_name: 'color_list', name: 'blue', label: ['Blue'], $kuid: 'cl1', $autovalue: 'blue' },
    { list_name: 'color_list', name: 'red', label: ['Red'], $kuid: 'cl2', $autovalue: 'red' },
  ],
  settings: {},
  translations: [null],
  translated: ['label'],
} as unknown as AssetContent

describe('skip logic — selected() function syntax', () => {
  it('selected() expression survives round-trip', () => {
    const survey = loadSurvey(SELECT_MULTIPLE_LOGIC_FORM)
    const output = serialize(survey)
    expect(getRelevant(output, 'explain_blue')).toBe("selected(${colors}, 'blue')")
  })

  it('not(selected()) expression survives round-trip', () => {
    const survey = loadSurvey(SELECT_MULTIPLE_LOGIC_FORM)
    const output = serialize(survey)
    expect(getRelevant(output, 'not_red')).toBe("not(selected(${colors}, 'red'))")
  })
})

// ---------------------------------------------------------------------------
// Constraint (validation logic) — uses '.' instead of '${name}'
// ---------------------------------------------------------------------------

const CONSTRAINT_FORM: AssetContent = {
  survey: [
    { type: 'integer', name: 'age', label: ['Age'], $kuid: 'vl1', $autoname: 'age', $xpath: 'age', constraint: '. > 0 and . < 150', constraint_message: 'Must be between 1 and 149', required: false },
    { type: 'text', name: 'email', label: ['Email'], $kuid: 'vl2', $autoname: 'email', $xpath: 'email', constraint: ". != ''", required: false },
  ],
  choices: [],
  settings: {},
  translations: [null],
  translated: ['label'],
} as unknown as AssetContent

describe('validation logic (constraint) — round-trip', () => {
  it('dot-based constraint expression survives round-trip', () => {
    const survey = loadSurvey(CONSTRAINT_FORM)
    const output = serialize(survey)
    const ageRow = output.survey.find((r: any) => r.$autoname === 'age')
    expect(ageRow.constraint).toBe('. > 0 and . < 150')
    expect(ageRow.constraint_message).toBe('Must be between 1 and 149')
  })

  it('simple existence constraint survives round-trip', () => {
    const survey = loadSurvey(CONSTRAINT_FORM)
    const output = serialize(survey)
    const emailRow = output.survey.find((r: any) => r.$autoname === 'email')
    expect(emailRow.constraint).toBe(". != ''")
  })
})
