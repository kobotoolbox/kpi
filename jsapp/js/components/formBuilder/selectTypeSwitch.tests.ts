import chai from 'chai'
import type { Row } from '../../../xlform/src/model.row'
import { Survey } from '../../../xlform/src/model.survey'
import {
  getSelectTypeReferences,
  getSelectTypeSwitchLabel,
  switchSelectType,
  switchSelectTypeWithWarning,
} from './selectTypeSwitch'

const loadSurvey = (otherRows: Array<Record<string, string>> = []) =>
  Survey.loadDict({
    survey: [
      { type: 'select_one', select_from_list_name: 'colors', name: 'color', label: 'Color', required: true },
      ...otherRows,
    ],
    choices: [
      { list_name: 'colors', name: 'red', label: 'Red' },
      { list_name: 'colors', name: 'blue', label: 'Blue' },
    ],
  })

const getColorRow = (survey: Survey) => survey.rows.at(0) as Row

describe('switchSelectType', () => {
  it('swaps the type and keeps the rest of the row', () => {
    const survey = loadSurvey()
    switchSelectType(getColorRow(survey))
    const exported = survey.toFlatJSON()
    chai.expect(exported.survey[0]).to.include({
      type: 'select_multiple',
      select_from_list_name: 'colors',
      name: 'color',
      required: 'true',
    })
    chai.expect(exported.choices).to.have.length(2)

    switchSelectType(getColorRow(survey))
    chai.expect(survey.toFlatJSON().survey[0].type).to.equal('select_one')
  })
})

describe('getSelectTypeSwitchLabel', () => {
  it('names the type to switch to', () => {
    const row = getColorRow(loadSurvey())
    chai.expect(getSelectTypeSwitchLabel(row)).to.equal('Change to Select Many')
    switchSelectType(row)
    chai.expect(getSelectTypeSwitchLabel(row)).to.equal('Change to Select One')
  })
})

describe('getSelectTypeReferences', () => {
  it('lists rows whose skip logic, validation or calculation use the question', () => {
    const survey = loadSurvey([
      { type: 'text', name: 'why', label: 'Why', relevant: "${color} = 'red'" },
      { type: 'calculate', name: 'calc', calculation: "concat(${color}, '!')" },
      { type: 'text', name: 'unrelated', label: 'Unrelated', constraint: "${color_2} != ''" },
    ])
    const names = getSelectTypeReferences(getColorRow(survey)).map((row) => row.getValue('name'))
    chai.expect(names).to.deep.equal(['why', 'calc'])
  })
})

describe('switchSelectTypeWithWarning', () => {
  it('switches without asking when nothing uses the question', () => {
    const row = getColorRow(loadSurvey())
    let switchedCount = 0
    switchSelectTypeWithWarning(row, () => switchedCount++)
    chai.expect(switchedCount).to.equal(1)
    chai.expect(row.getTypeId()).to.equal('select_multiple')
  })
})
