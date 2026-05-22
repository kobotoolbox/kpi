import { useEffect, useState } from 'react'

import type { SelectProps } from '@mantine/core'
// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper around Mantine Select.
import { Select as MantineSelect } from '@mantine/core'

import type { IconSize } from './icon'
import Icon from './icon'

const iconSizeMap: Record<string, IconSize> = {
  xs: 'xxs',
  sm: 'xs',
  md: 's',
  lg: 'm',
  xl: 'l',
}

interface ComboboxStringItem<T extends string> {
  value: T
  disabled?: boolean
}
interface ComboboxItem<T extends string> extends ComboboxStringItem<T> {
  label: string
}
interface ComboboxItemGroup<T extends string, Item = ComboboxItem<T> | T> {
  group: string
  items: Item[]
}
type ComboboxData<T extends string> =
  | Array<string | ComboboxItem<T> | ComboboxItemGroup<T>>
  | ReadonlyArray<string | ComboboxItem<T> | ComboboxItemGroup<T>>

interface SelectPropsNarrow<Datum extends string = string> extends Omit<SelectProps, 'onChange'> {
  data: ComboboxData<Datum>
  value?: Datum | null
  onChange?: (newValue: Datum | null, option: ComboboxItem<Datum>) => void
}

const Select = <Datum extends string = string>(props: SelectPropsNarrow<Datum>) => {
  const [value, setValue] = useState<Datum | null>(props.value || null)
  const [isOpened, setIsOpened] = useState(props.defaultDropdownOpened || false)

  const onChange = (newValue: string | null, option: ComboboxItem<string>) => {
    setValue(newValue as Datum | null)
    props.onChange?.(newValue as Datum | null, option as ComboboxItem<Datum>)
  }

  useEffect(() => {
    setValue(props.value || null)
  }, [props.value])

  const iconSize = typeof props.size === 'string' ? iconSizeMap[props.size] : 's'
  // Allow callers to render custom content (for example a loading spinner)
  // instead of always forcing the default chevron icon.
  const rightSection = props.rightSection ?? <Icon name={isOpened ? 'angle-up' : 'angle-down'} size={iconSize} />

  return (
    <MantineSelect
      {...props}
      value={value}
      onChange={onChange}
      onDropdownOpen={() => setIsOpened(true)}
      onDropdownClose={() => setIsOpened(false)}
      rightSection={rightSection}
    />
  )
}

export default Select
