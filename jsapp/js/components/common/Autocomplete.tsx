import type { AutocompleteProps } from '@mantine/core'
import { Group, Autocomplete as MantineAutocomplete } from '@mantine/core'
import { useState } from 'react'
import Icon from './icon'

// TODO: These props are subject to change pending the replacement of the language selector see DEV-1401. Most likely
// going to resemble Select.tsx
interface AutocompletePropsNarrow extends Omit<AutocompleteProps, 'rightSection'> {}

const Autocomplete = (props: AutocompletePropsNarrow) => {
  const [isOpened, setIsOpened] = useState(props.defaultDropdownOpened || false)

  return (
    <MantineAutocomplete
      {...props}
      onDropdownOpen={() => {
        setIsOpened(true)
        props.onDropdownOpen?.()
      }}
      onDropdownClose={() => {
        setIsOpened(false)
        props.onDropdownClose?.()
      }}
      rightSection={
        <Group gap={1} mr='sm'>
          <Icon name={isOpened ? 'angle-up' : 'angle-down'} size={'m'} />
        </Group>
      }
    />
  )
}

export default Autocomplete
