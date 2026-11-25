import { DATA_TABLE_SETTINGS, SUBMISSION_ACTIONS_ID, SortValues } from '#/components/submissions/tableConstants'
import {
  getFieldSortValue,
  getFrozenColumns,
  getHiddenColumns,
  getShowGroupName,
  getShowHXLTags,
  getSortBy,
  getTranslationIndex,
  isFieldVisible,
} from '#/components/submissions/tableSettingsUtils'

describe('tableSettingsUtils', () => {
  it('should return defaults for empty settings', () => {
    chai.expect(getHiddenColumns({})).to.deep.equal([])
    chai.expect(getFrozenColumns({})).to.deep.equal([])
    chai.expect(getSortBy({})).to.equal(null)
    chai.expect(getShowGroupName({})).to.equal(true)
    chai.expect(getTranslationIndex({})).to.equal(0)
    chai.expect(getShowHXLTags({})).to.equal(false)
  })

  it('should keep question names (`-1`) as translation index', () => {
    chai.expect(getTranslationIndex({ [DATA_TABLE_SETTINGS.TRANSLATION]: -1 })).to.equal(-1)
  })

  it('should give sort value of the sorted column only', () => {
    const tableSettings = { [DATA_TABLE_SETTINGS.SORT_BY]: { fieldId: 'Age', value: SortValues.DESCENDING } }

    chai.expect(getFieldSortValue(tableSettings, 'Age')).to.equal(SortValues.DESCENDING)
    chai.expect(getFieldSortValue(tableSettings, 'Name')).to.equal(null)
  })

  it('should never hide frozen or submission actions columns', () => {
    const tableSettings = {
      [DATA_TABLE_SETTINGS.HIDDEN_COLUMNS]: ['Age', 'Name', SUBMISSION_ACTIONS_ID],
      [DATA_TABLE_SETTINGS.FROZEN_COLUMN]: ['Age'],
    }

    chai.expect(isFieldVisible(tableSettings, 'Age')).to.equal(true)
    chai.expect(isFieldVisible(tableSettings, SUBMISSION_ACTIONS_ID)).to.equal(true)
    chai.expect(isFieldVisible(tableSettings, 'Name')).to.equal(false)
  })
})
