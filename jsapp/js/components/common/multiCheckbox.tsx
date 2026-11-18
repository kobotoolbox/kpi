import { Box, Checkbox, Divider, Group, Stack } from '@mantine/core'
import { type ReactNode, useId } from 'react'
import ButtonNew from '#/components/common/ButtonNew'

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
  /** Displayed above the list. */
  label?: ReactNode
  /** Adds "Select all" and "Deselect all" buttons above the list. */
  hasBulkSelect?: boolean
  /** Fixed height of the list. It scrolls, while label and buttons stay visible. */
  listHeight?: number
}

/**
 * A MultiCheckbox generic component.
 */
export default function MultiCheckbox(props: MultiCheckboxProps) {
  const labelId = useId()

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

  /** Disabled items keep their state. */
  function setAllChecked(isChecked: boolean) {
    props.onChange(props.items.map((item) => (item.disabled ? item : { ...item, checked: isChecked })))
  }

  // Bulk buttons only look at items the user can change
  const changeableItems = props.disabled ? [] : props.items.filter((item) => !item.disabled)
  const isFrame = props.type === 'frame'

  return (
    <Stack gap='xs' w='100%' className={props.className}>
      {(props.label || props.hasBulkSelect) && (
        <Group justify='space-between' gap='xs'>
          {props.label && <Box id={labelId}>{props.label}</Box>}

          {props.hasBulkSelect && (
            <Group gap='xs' wrap='nowrap' ml='auto'>
              <ButtonNew
                variant='light'
                size='sm'
                disabled={changeableItems.every((item) => item.checked)}
                onClick={() => setAllChecked(true)}
              >
                {t('Select all')}
              </ButtonNew>

              <Divider orientation='vertical' />

              <ButtonNew
                variant='light'
                size='sm'
                disabled={!changeableItems.some((item) => item.checked)}
                onClick={() => setAllChecked(false)}
              >
                {t('Deselect all')}
              </ButtonNew>
            </Group>
          )}
        </Group>
      )}

      <Stack
        component='ul'
        aria-labelledby={props.label ? labelId : undefined}
        gap='sm'
        m={0}
        ta='start'
        h={props.listHeight}
        // Bare still needs some padding, so focus rings don't get cut off
        p={isFrame ? 'sm' : 4}
        bd={isFrame ? '1px solid var(--mantine-color-gray-6)' : undefined}
        bdrs={isFrame ? 'xs' : undefined}
        dir='auto'
        // Fills the root when it has a fixed height (e.g. via `className`), and scrolls
        style={{ flex: 'auto', minHeight: 0, listStyle: 'none', overflowX: 'hidden', overflowY: 'auto' }}
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
    </Stack>
  )
}
