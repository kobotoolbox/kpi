import type { MultiSelectProps } from '@mantine/core'
// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper around Mantine MultiSelect.
import { MultiSelect as MantineMultiSelect } from '@mantine/core'
import { useEffect, useState } from 'react'

import type { ComboboxData } from './select.types'
import { useSelectChevron } from './useSelectChevron'

interface MultiSelectPropsNarrow<Datum extends string = string>
  extends Omit<MultiSelectProps, 'onChange' | 'value' | 'defaultValue'> {
  data: ComboboxData<Datum>
  value?: Datum[]
  defaultValue?: Datum[]
  onChange?: (newValue: Datum[]) => void
}

const MultiSelect = <Datum extends string = string>(props: MultiSelectPropsNarrow<Datum>) => {
  const [value, setValue] = useState<Datum[]>(props.value || [])
  const { rightSection, rightSectionWidth, onDropdownOpen, onDropdownClose } = useSelectChevron({
    size: props.size,
    rightSection: props.rightSection,
    rightSectionWidth: props.rightSectionWidth,
    defaultDropdownOpened: props.defaultDropdownOpened,
  })

  useEffect(() => {
    setValue(props.value || [])
  }, [props.value])

  const onChange = (newValue: string[]) => {
    const nextValue = newValue as Datum[]
    setValue(nextValue)
    props.onChange?.(nextValue)
  }

  // Render the dropdown in-place by default.
  // In our app layout/modals, portal rendering has intermittently triggered
  // "ResizeObserver loop completed with undelivered notifications" when many
  // pills wrap over multiple lines.
  const mergedComboboxProps = {
    withinPortal: false,
    ...props.comboboxProps,
  }

  return (
    <MantineMultiSelect
      {...props}
      value={value}
      onChange={onChange}
      onDropdownOpen={onDropdownOpen}
      onDropdownClose={onDropdownClose}
      rightSection={rightSection}
      rightSectionWidth={rightSectionWidth}
      comboboxProps={mergedComboboxProps}
    />
  )
}

export default MultiSelect
