import './multiCheckbox.scss'

import React from 'react'

import bem, { makeBem } from '#/bem'
import Checkbox from '#/components/common/checkbox'

bem.MultiCheckbox = makeBem(null, 'multi-checkbox', 'ul')
bem.MultiCheckbox__item = makeBem(bem.MultiCheckbox, 'item', 'li')

export type MultiCheckboxType = 'bare' | 'frame'

type RecordUnknown = Record<string | number | symbol, unknown>

export type MultiCheckboxItem<T extends RecordUnknown = RecordUnknown> = T & {
  checked: boolean
  disabled?: boolean
  label: string
}

interface MultiCheckboxProps<T extends RecordUnknown = RecordUnknown> {
  /** Influences how the component looks. */
  type: MultiCheckboxType
  items: MultiCheckboxItem<T>[]
  /** Use this to disable all checkboxes - useful for blocking changes while loading. */
  disabled?: boolean
  /** Returns whole list whenever any item changes */
  onChange: (items: MultiCheckboxItem<T>[]) => void
  /** Additional class names. */
  className?: string
}

/**
 * A MultiCheckbox generic component.
 * Use optional `bem.MultiCheckbox__wrapper` to display a frame around it.
 */
export default function MultiCheckbox<T extends RecordUnknown = RecordUnknown>(props: MultiCheckboxProps<T>) {
  function onChange(itemIndex: number, isChecked: boolean) {
    const updatedList = props.items
    updatedList[itemIndex].checked = isChecked
    props.onChange(updatedList)
  }

  return (
    <bem.MultiCheckbox m={`type-${props.type}`} className={props.className} dir='auto'>
      {props.items.map((item, itemIndex) => (
        <bem.MultiCheckbox__item key={itemIndex}>
          <Checkbox
            checked={item.checked}
            disabled={props.disabled || item.disabled}
            onChange={(isChecked: boolean) => {
              onChange(itemIndex, isChecked)
            }}
            label={item.label}
          />
        </bem.MultiCheckbox__item>
      ))}
    </bem.MultiCheckbox>
  )
}
