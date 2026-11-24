import { Box, Checkbox, Stack } from '@mantine/core'

export type MultiCheckboxType = 'bare' | 'frame'

export interface MultiCheckboxItem {
  /** any other properties will be passed back with onChange */
  [propName: string]: any
  checked: boolean
  disabled?: boolean
  label: string
  hint?: string
}

interface MultiCheckboxProps {
  /** Influences how the component looks. */
  type: MultiCheckboxType
  items: MultiCheckboxItem[]
  /** Use this to disable all checkboxes - useful for blocking changes while loading. */
  disabled?: boolean
  /** Returns whole list whenever any item changes */
  onChange: (items: MultiCheckboxItem[]) => void
  /** Additional class names. */
  className?: string
}

/**
 * A MultiCheckbox generic component.
 */
export default function MultiCheckbox(props: MultiCheckboxProps) {
  function onChange(itemIndex: number, isChecked: boolean) {
    const updatedList = props.items.map((item, currentItemIndex) => {
      if (currentItemIndex !== itemIndex) {
        return item
      }

      return {
        ...item,
        checked: isChecked,
      }
    })

    props.onChange(updatedList)
  }

  const isFrame = props.type === 'frame'

  return (
    <Stack
      component='ul'
      gap='sm'
      m={0}
      w='100%'
      ta='start'
      // Bare still needs some padding, so focus rings don't get cut off
      p={isFrame ? 'sm' : 4}
      bd={isFrame ? '1px solid var(--mantine-color-gray-6)' : undefined}
      bdrs={isFrame ? 'xs' : undefined}
      className={props.className}
      dir='auto'
      style={{ listStyle: 'none', overflowX: 'hidden', overflowY: 'auto' }}
    >
      {props.items.map((item, itemIndex) => (
        <Box component='li' key={itemIndex}>
          <Checkbox
            checked={item.checked}
            disabled={props.disabled || item.disabled}
            onChange={(evt) => onChange(itemIndex, evt.currentTarget.checked)}
            // When there's a hint displayed, the label needs to be more prominent
            label={item.hint ? <strong>{item.label}</strong> : item.label}
            description={item.hint}
            // Theme's dimmed color is too faint for hints
            styles={{ description: { color: 'var(--mantine-color-gray-2)' } }}
          />
        </Box>
      ))}
    </Stack>
  )
}
