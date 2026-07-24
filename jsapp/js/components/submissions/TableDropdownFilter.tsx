import React from 'react'
import type { Column, Filter, FilterRender } from 'react-table'
import { getQuestionOrChoiceDisplayName } from '#/assetUtils'
import Select from '#/components/common/Select'
import type { TableColumn } from '#/components/submissions/table.types'

interface TableDropdownFilterProps {
  column: TableColumn | Column<any>
  filter?: Filter
  onChange: (value?: string) => void
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
const SHOW_ALL_VALUE = '__show_all__'

const TableDropdownFilter: FilterRender = (props: TableDropdownFilterProps) => {
  const choices = 'choices' in props.column ? props.column.choices || [] : []
  const selectFromListName = 'selectFromListName' in props.column ? props.column.selectFromListName : undefined
  const translationIndex = 'translationIndex' in props.column ? props.column.translationIndex || 0 : 0

  // Duplicate values can exist in the choices array, so we use a Set to filter them out
  const seenValues = new Set<string>()
  const data = [
    { value: SHOW_ALL_VALUE, label: t('Show All') },
    ...choices
      .filter((choiceItem) => choiceItem.list_name === selectFromListName)
      .filter((item) => {
        if (seenValues.has(item.name)) return false
        seenValues.add(item.name)
        return true
      })
      .map((item) => {
        return {
          value: item.name,
          label: getQuestionOrChoiceDisplayName(item, translationIndex),
        }
      }),
  ]

  // Map internal filter value (empty string) to our sentinel value for display
  const displayValue = !props.filter || props.filter.value === '' ? SHOW_ALL_VALUE : props.filter.value

  return (
    <Select
      data={data}
      value={displayValue}
      onChange={(newValue) => {
        // Map sentinel value back to empty string for React-Table
        props.onChange(newValue === SHOW_ALL_VALUE ? '' : newValue || '')
      }}
      size='xs'
      clearable={false}
    />
  )
}

export default TableDropdownFilter
