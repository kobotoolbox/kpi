import { destroyConfirm } from '#/alertify'
import { QuestionTypeName } from '#/constants'
import { escapeHtml } from '#/utils'
import type { BaseRow, Row } from '../../../xlform/src/model.row'
import type { Survey } from '../../../xlform/src/model.survey'
import { hasQuestionReference } from './questionReferences'

/** Columns where a rule written for Select One may stop working for Select Many (and the other way round) */
const REFERENCE_COLUMNS = ['relevant', 'constraint', 'calculation']

export function getSelectTypeSwitchLabel(row: Row) {
  return row.getTypeId() === QuestionTypeName.select_one ? t('Change to Select Many') : t('Change to Select One')
}

/** Swaps Select One ←→ Select Many */
export function switchSelectType(row: Row) {
  const newTypeId =
    row.getTypeId() === QuestionTypeName.select_one ? QuestionTypeName.select_multiple : QuestionTypeName.select_one
  const typeDetail = row.get('type')
  typeDetail.set('value', typeDetail.get('value').replace(/^\S+/, newTypeId))
  // A `type` change doesn't mark the form as unsaved by itself
  row.getSurvey().trigger('change')
}

/**
 * Other rows whose skip logic, validation or calculation use this one. These may break after a switch, since `=`
 * doesn't match Select Many answers.
 */
export function getSelectTypeReferences(row: Row): BaseRow[] {
  // Builder skip logic fills in a missing name when saving, so do it now
  if (row.getValue('label')) {
    row.finalize()
  }
  const name = row.getValue('name')
  if (!name) {
    return []
  }

  const survey: Survey = row.getSurvey()
  const referencingRows: BaseRow[] = []
  survey.forEachRow(
    (otherRow) => {
      // Not every row has these columns, and `getValue('column')` throws on a missing one
      const isReferencing =
        otherRow !== row &&
        REFERENCE_COLUMNS.some((column) => {
          const value = otherRow.get(column)?.getValue?.()
          return typeof value === 'string' && hasQuestionReference(value, name)
        })
      if (isReferencing) {
        referencingRows.push(otherRow)
      }
    },
    { includeGroups: true },
  )
  return referencingRows
}

/**
 * Switches the type right away, or after a warning if other rows use this one. We don't rewrite their rules.
 * `onSwitched` runs only once the type has changed.
 */
export function switchSelectTypeWithWarning(row: Row, onSwitched: () => void) {
  const doSwitch = () => {
    switchSelectType(row)
    onSwitched()
  }

  const referencingRows = getSelectTypeReferences(row)
  if (referencingRows.length === 0) {
    doSwitch()
    return
  }

  const rowsHtml = referencingRows
    .map((otherRow) => `<li>${escapeHtml(otherRow.get('label')?.getValue() || otherRow.get('name')?.getValue())}</li>`)
    .join('')
  destroyConfirm(
    doSwitch,
    t('Change question type?'),
    t('Change type'),
    `<p>${t(
      'These questions use this one in their skip logic, validation or calculation. Select One and Select Many answers are matched differently, so these rules may stop working and need to be updated:',
    )}</p><ul class="select-type-switch__references">${rowsHtml}</ul>`,
  )
}
