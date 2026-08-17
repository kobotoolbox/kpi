import React from 'react'

import Select from '#/components/common/Select'
import { COLLECTION_METHODS, type CollectionMethodName } from '#/constants'
import { recordEntries } from '#/utils'
import styles from './collectMethodSelector.module.scss'

interface CollectMethodSelectorProps {
  onChange: (method: CollectionMethodName) => void
  selectedMethod: CollectionMethodName
}

export default function CollectMethodSelector(props: CollectMethodSelectorProps) {
  const methodsList: Array<{
    value: CollectionMethodName
    label: string
  }> = []
  for (const [, methodDef] of recordEntries(COLLECTION_METHODS)) {
    methodsList.push({
      value: methodDef.id,
      label: methodDef.label,
    })
  }

  return (
    <Select
      size='sm'
      clearable={false}
      data={methodsList}
      value={props.selectedMethod}
      onChange={(newMethod) => {
        if (newMethod !== null) {
          props.onChange(newMethod)
        }
      }}
      className={styles.collectMethodSelector}
    />
  )
}
