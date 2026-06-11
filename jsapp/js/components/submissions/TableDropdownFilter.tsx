import React from 'react'
import { getQuestionOrChoiceDisplayName } from '#/assetUtils'
import type { SurveyChoice } from '#/dataInterface'

interface TableDropdownFilterProps {
  filter: any
  onChange: (value: any) => void
  choices: SurveyChoice[]
  selectFromListName?: string
  translationIndex: number
}

/**
 * Dropdown filter component for data table columns.
 * Defined as a stable component to prevent React from unmounting/remounting on every render,
 * which would cause focus loss when typing in filter inputs.
 */
export default function TableDropdownFilter(props: TableDropdownFilterProps) {
  return (
    <select
      onChange={(event) => props.onChange(event.target.value)}
      style={{ width: '100%' }}
      value={props.filter ? props.filter.value : ''}
    >
      <option value=''>{t('Show All')}</option>
      {props.choices
        .filter((choiceItem) => choiceItem.list_name === props.selectFromListName)
        .map((item, n) => {
          const displayName = getQuestionOrChoiceDisplayName(item, props.translationIndex)
          return (
            <option value={item.name} key={n}>
              {displayName}
            </option>
          )
        })}
    </select>
  )
}
