import React from 'react'

import KoboSelect from '#/components/common/koboSelect'
import { COLLECTION_METHODS, type CollectionMethodName } from '#/constants'
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
  for (const [, methodDef] of Object.entries(COLLECTION_METHODS)) {
    methodsList.push({
      value: methodDef.id,
      label: methodDef.label,
    })
  }

  return (
    <KoboSelect
      name='collect-method-selector'
      type='outline'
      size='m'
      placement={'down-left'}
      isClearable={false}
      options={methodsList}
      selectedOption={props.selectedMethod}
      onChange={(newMethod) => {
        if (newMethod !== null) {
          props.onChange(newMethod as CollectionMethodName)
        }
      }}
      className={styles.collectMethodSelector}
    />
  )
}
