import type { SelectProps } from '@mantine/core'
// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper around Mantine Select.
import { Select as MantineSelect } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { ComboboxData, ComboboxItem } from './select.types'
import { useSelectChevron } from './useSelectChevron'

interface SelectPropsNarrow<Datum extends string = string> extends Omit<SelectProps, 'onChange'> {
  data: ComboboxData<Datum>
  value?: Datum | null
  onChange?: (newValue: Datum | null, option: ComboboxItem<Datum>) => void
}

const Select = <Datum extends string = string>(props: SelectPropsNarrow<Datum>) => {
  const [value, setValue] = useState<Datum | null>(props.value || null)
  const { rightSection, rightSectionWidth, onDropdownOpen, onDropdownClose } = useSelectChevron({
    size: props.size,
    rightSection: props.rightSection,
    rightSectionWidth: props.rightSectionWidth,
    defaultDropdownOpened: props.defaultDropdownOpened,
  })

  const onChange = (newValue: string | null, option: ComboboxItem<string>) => {
    setValue(newValue as Datum | null)
    props.onChange?.(newValue as Datum | null, option as ComboboxItem<Datum>)
  }

  useEffect(() => {
    setValue(props.value || null)
  }, [props.value])

  return (
    <MantineSelect
      {...props}
      value={value}
      onChange={onChange}
      onDropdownOpen={onDropdownOpen}
      onDropdownClose={onDropdownClose}
      rightSection={rightSection}
      rightSectionWidth={rightSectionWidth}
    />
  )
}

export default Select
