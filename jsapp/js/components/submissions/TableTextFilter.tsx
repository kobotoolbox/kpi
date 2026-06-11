import React from 'react'
import type { Column, Filter } from 'react-table'
import DebouncedTextInput from '#/components/common/DebouncedTextInput'
import type { SubmissionResponse } from '#/dataInterface'

interface TableTextFilterProps {
  column: Column<SubmissionResponse>
  filter?: Filter
  onChange: (value?: string) => void
  key?: string
}

/**
 * Text input filter component for data table columns.
 * Defined as a stable component to prevent React from unmounting/remounting on every render,
 * which would cause focus loss and debounce reset when typing in filter inputs.
 */
export default function TableTextFilter(props: TableTextFilterProps) {
  return (
    <DebouncedTextInput
      value={props.filter ? props.filter.value : undefined}
      onChange={props.onChange}
      placeholder={t('Search')}
      size='xs'
    />
  )
}
