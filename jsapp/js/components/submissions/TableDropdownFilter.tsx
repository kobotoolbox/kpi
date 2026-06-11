import React from 'react'
import { getQuestionOrChoiceDisplayName } from '#/assetUtils'
import type { SurveyChoice } from '#/dataInterface'

interface TableDropdownFilterProps {
  filter: any
  onChange: (value: any) => void
  column: any // React-Table column object with custom properties
}

/**
 * Dropdown filter component for data table columns.
 * Defined as a stable component to prevent React from unmounting/remounting on every render,
 * which would cause focus loss when typing in filter inputs.
 *
 * Column-specific data (choices, selectFromListName, translationIndex) is read from
 * the column object that React-Table passes in, allowing this component to be used
 * as a stable reference without wrapper functions.
 */
export default function TableDropdownFilter(props: TableDropdownFilterProps) {
  const choices: SurveyChoice[] = props.column.choices || []
  const selectFromListName: string | undefined = props.column.selectFromListName
  const translationIndex: number = props.column.translationIndex || 0

  return (
    <select
      onChange={(event) => props.onChange(event.target.value)}
      style={{ width: '100%' }}
      value={props.filter ? props.filter.value : ''}
    >
      <option value=''>{t('Show All')}</option>
      {choices
        .filter((choiceItem) => choiceItem.list_name === selectFromListName)
        .map((item, n) => {
          const displayName = getQuestionOrChoiceDisplayName(item, translationIndex)
          return (
            <option value={item.name} key={n}>
              {displayName}
            </option>
          )
        })}
    </select>
  )
}
