import React from 'react'
import type { Column, Filter, FilterRender } from 'react-table'
import { getQuestionOrChoiceDisplayName } from '#/assetUtils'
import Select from '#/components/common/Select'
import type { TableColumn } from '#/components/submissions/table.types'
import type { SurveyChoice } from '#/dataInterface'

const getChoiceFilterValue = (item: SurveyChoice): string | undefined =>
  item.name || item.$autoname || item.$autovalue || undefined

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

  interface ChoiceOption { value: string; label: string }
  const seenValues = new Set<string>()
  const choiceOptions = choices.reduce<ChoiceOption[]>((acc, item) => {
    if (item.list_name !== selectFromListName) return acc
    const value = getChoiceFilterValue(item)
    if (!value || seenValues.has(value)) return acc
    seenValues.add(value)
    acc.push({ value, label: getQuestionOrChoiceDisplayName(item, translationIndex) })
    return acc
  }, [])
  const data = [{ value: SHOW_ALL_VALUE, label: t('Show All') }, ...choiceOptions]

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
