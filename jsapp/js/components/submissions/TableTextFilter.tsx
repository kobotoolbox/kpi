import React from 'react'
import type { Column, Filter, FilterRender } from 'react-table'
import DebouncedTextInput from '#/components/common/DebouncedTextInput'
import type { TableColumn } from './table.types'

interface TableTextFilterProps {
  column: TableColumn | Column<any>
  filter?: Filter
  onChange: (value?: string) => void
  key?: string
}

/**
 * Text input filter component for data table columns.
 * Defined as a stable component to prevent React from unmounting/remounting on every render,
 * which would cause focus loss and debounce reset when typing in filter inputs.
 */
const TableTextFilter: FilterRender = (props: TableTextFilterProps) => (
  <DebouncedTextInput
    value={props.filter ? props.filter.value : undefined}
    onChange={props.onChange}
    placeholder={t('Search')}
    size='xs'
  />
)

export default TableTextFilter
