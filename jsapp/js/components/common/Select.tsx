import type { ComboboxItem, SelectProps } from '@mantine/core'
import { CloseButton, Group, Select as MantineSelect } from '@mantine/core'
import { useEffect, useState } from 'react'

import type { IconSize } from './icon'
import Icon from './icon'

declare module '@mantine/core/lib/components/Select' {
  /** @deprecated use Kobo implementation instead. (deprecating a new interface because can't augment variables) */
  export interface Select {}
}

const iconSizeMap: Record<string, IconSize> = {
  xs: 'xxs',
  sm: 'xs',
  md: 's',
  lg: 'm',
  xl: 'l',
}

const Select = (props: SelectProps) => {
  const [value, setValue] = useState<string | null>(props.value || null)
  const [isOpened, setIsOpened] = useState(props.defaultDropdownOpened || false)

  const onChange = (newValue: string | null, option: ComboboxItem) => {
    setValue(newValue)
    props.onChange?.(newValue, option)
  }

  const clear = () => {
    setValue(null)
    props.onClear?.()
  }

  useEffect(() => {
    setValue(props.value || null)
  }, [props.value])

  const iconSize = typeof props.size === 'string' ? iconSizeMap[props.size] : 's'

  const clearButton =
    props.clearable && value && !props.disabled && !props.readOnly ? (
      <CloseButton onClick={clear} icon={<Icon name='close' size={iconSize} />} />
    ) : null

  return (
    <MantineSelect
      {...props}
      value={value}
      onChange={onChange}
      onDropdownOpen={() => setIsOpened(true)}
      onDropdownClose={() => setIsOpened(false)}
      rightSection={
        <Group gap={1} mr='sm'>
          {clearButton}
          <Icon name={isOpened ? 'angle-up' : 'angle-down'} size={iconSize} />
        </Group>
      }
    />
  )
}

export default Select
