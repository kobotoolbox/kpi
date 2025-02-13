// Libraries
import React from 'react';

// Partial components
import KoboSelect from 'js/components/common/koboSelect';

// Constants
import {CollectionMethodName, COLLECTION_METHODS} from 'js/constants';

// Styles
import styles from './collectMethodSelector.module.scss';

interface CollectMethodSelectorProps {
  onChange: (method: CollectionMethodName) => void;
  selectedMethod: CollectionMethodName;
}

export default function CollectMethodSelector(props: CollectMethodSelectorProps) {
  const methodsList: Array<{
    value: CollectionMethodName;
    label: string;
  }> = [];
  for (const [, methodDef] of Object.entries(COLLECTION_METHODS)) {
    methodsList.push({
      value: methodDef.id,
      label: methodDef.label,
    });
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
          props.onChange(newMethod as CollectionMethodName);
        }
      }}
      className={styles.collectMethodSelector}
    />
  );
}
