import './multiCheckbox.scss'

import React from 'react'

import { Stack, Text } from '@mantine/core'
import bem, { makeBem } from '#/bem'
import Checkbox from '#/components/common/checkbox'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'

bem.MultiCheckbox = makeBem(null, 'multi-checkbox', 'ul')
bem.MultiCheckbox__item = makeBem(bem.MultiCheckbox, 'item', 'li')

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
 * Use optional `bem.MultiCheckbox__wrapper` to display a frame around it.
 */
export default function MultiCheckbox(props: MultiCheckboxProps) {
  const autoQAEnabled = useFeatureFlag(FeatureFlag.autoQAEnabled)

  function onChange(itemIndex: number, isChecked: boolean) {
    const updatedList = props.items
    updatedList[itemIndex].checked = isChecked
    props.onChange(updatedList)
  }

  return (
    <bem.MultiCheckbox m={`type-${props.type}`} className={props.className} dir='auto'>
      {props.items.map((item, itemIndex) => {
        return (
          <bem.MultiCheckbox__item key={itemIndex}>
            <Stack gap='0'>
              <Checkbox
                checked={item.checked}
                disabled={props.disabled || item.disabled}
                onChange={(isChecked: boolean) => {
                  onChange(itemIndex, isChecked)
                }}
                // When there's a hint displayed, the label needs to be more prominent
                label={autoQAEnabled && item.hint ? <strong>{item.label}</strong> : item.label}
              />

              {autoQAEnabled && item.hint && (
                <Text pl='26px' fz='xs' m='0' ta='left' c='var(--mantine-color-gray-2)'>
                  {item.hint}
                </Text>
              )}
            </Stack>
          </bem.MultiCheckbox__item>
        )
      })}
    </bem.MultiCheckbox>
  )
}
