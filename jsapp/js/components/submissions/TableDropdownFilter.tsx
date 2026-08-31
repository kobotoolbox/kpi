import React from 'react'
import type { Column, Filter, FilterRender } from 'react-table'
import { getQuestionOrChoiceDisplayName } from '#/assetUtils'
import Select from '#/components/common/Select'
import type { TableColumn } from '#/components/submissions/table.types'
import type { LabelValuePair, SurveyChoice } from '#/dataInterface'

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
const TableDropdownFilter: FilterRender = (props: TableDropdownFilterProps) => {
  const choices = 'choices' in props.column ? props.column.choices || [] : []
  const selectFromListName = 'selectFromListName' in props.column ? props.column.selectFromListName : undefined
  const translationIndex = 'translationIndex' in props.column ? props.column.translationIndex || 0 : 0

  const seenValues = new Set<string>()
  const choiceOptions = choices.reduce<LabelValuePair[]>((acc, item) => {
    if (item.list_name !== selectFromListName) return acc
    const value = getChoiceFilterValue(item)
    if (!value || seenValues.has(value)) return acc
    seenValues.add(value)
    acc.push({ value, label: getQuestionOrChoiceDisplayName(item, translationIndex) })
    return acc
  }, [])
  // React-Table spells "no filter on this column" as an empty string, which is
  // also the value of the "Show all" option.
  const data = [{ value: '', label: t('Show all') }, ...choiceOptions]

  return (
    <Select
      data={data}
      value={props.filter?.value ?? ''}
      onChange={(newValue) => props.onChange(newValue ?? '')}
      size='xs'
      clearable={false}
    />
  )
}

export default TableDropdownFilter
