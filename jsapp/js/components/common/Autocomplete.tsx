import type { AutocompleteProps } from "@mantine/core";
import { Group, Autocomplete as MantineAutocomplete } from '@mantine/core'
import { useState } from 'react'
import Icon from './icon'

const Autocomplete = (props: AutocompleteProps) => {
  const [isOpened, setIsOpened] = useState(props.defaultDropdownOpened || false)

  return (
    <MantineAutocomplete
      {...props}
      onDropdownOpen={() => setIsOpened(true)}
      onDropdownClose={() => setIsOpened(false)}
      rightSection={
        <Group gap={1} mr='sm'>
          <Icon name={isOpened ? 'angle-up' : 'angle-down'} size={'m'} />
        </Group>
      }
    />
  )
}

export default Autocomplete
