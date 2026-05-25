import type { MultiSelectProps } from '@mantine/core'
// eslint-disable-next-line no-restricted-imports -- This file is the Kobo wrapper around Mantine MultiSelect.
import { MultiSelect as MantineMultiSelect } from '@mantine/core'
import { useEffect, useState } from 'react'

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

interface MultiSelectPropsNarrow<Datum extends string = string>
  extends Omit<MultiSelectProps, 'onChange' | 'value' | 'defaultValue'> {
  data: ComboboxData<Datum>
  value?: Datum[]
  defaultValue?: Datum[]
  onChange?: (newValue: Datum[]) => void
}

const MultiSelect = <Datum extends string = string>(props: MultiSelectPropsNarrow<Datum>) => {
  const [value, setValue] = useState<Datum[]>(props.value || [])
  const [isOpened, setIsOpened] = useState(props.defaultDropdownOpened || false)

  const iconSize = typeof props.size === 'string' ? iconSizeMap[props.size] : 's'
  // Allow callers to render custom content (for example a loading spinner)
  // instead of always forcing the default chevron icon.
  const rightSection = props.rightSection ?? <Icon name={isOpened ? 'angle-up' : 'angle-down'} size={iconSize} />

  useEffect(() => {
    setValue(props.value || [])
  }, [props.value])

  const onChange = (newValue: string[]) => {
    const nextValue = newValue as Datum[]
    setValue(nextValue)
    props.onChange?.(nextValue)
  }

  return (
    <MantineMultiSelect
      {...props}
      value={value}
      onChange={onChange}
      onDropdownOpen={() => setIsOpened(true)}
      onDropdownClose={() => setIsOpened(false)}
      rightSection={rightSection}
    />
  )
}

export default MultiSelect
