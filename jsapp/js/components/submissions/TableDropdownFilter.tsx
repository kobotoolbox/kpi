import React from 'react'
import type { Column, Filter, FilterRender } from 'react-table'
import { getQuestionOrChoiceDisplayName } from '#/assetUtils'
import type { TableColumn } from '#/components/submissions/table.types'

interface TableDropdownFilterProps {
  column: TableColumn | Column<any>
  filter?: Filter
  onChange: (value?: string) => void
  key?: string
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
const TableDropdownFilter: FilterRender = (props: TableDropdownFilterProps) => {
  const choices = 'choices' in props.column ? props.column.choices || [] : []
  const selectFromListName = 'selectFromListName' in props.column ? props.column.selectFromListName : undefined
  const translationIndex = 'translationIndex' in props.column ? props.column.translationIndex || 0 : 0

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

export default TableDropdownFilter
