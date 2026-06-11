import React from 'react'
import DebouncedTextInput from '#/components/common/DebouncedTextInput'

interface TableTextFilterProps {
  filter: any
  onChange: (value: any) => void
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
