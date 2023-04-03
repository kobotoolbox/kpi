import React, {useState} from 'react';
import {fetchDelete} from 'js/api';
import {handleApiFail} from 'js/utils';
import KoboPrompt from 'js/components/modals/koboPrompt';
import Checkbox from 'js/components/common/checkbox';
import styles from './BulkDeletePrompt.module.scss';

interface BulkDeletePromptProps {
  assetUids: string[];
  onRequestClose: () => void;
}

export default function BulkDeletePrompt(props: BulkDeletePromptProps) {
  const [isDataChecked, setIsDataChecked] = useState(false);
  const [isFormChecked, setIsFormChecked] = useState(false);
  const [isRecoverChecked, setIsRecoverChecked] = useState(false);

  function onConfirmDelete() {
    console.log('AAA delete selected assets', props.assetUids);

    fetchDelete('/api/v2/assets/bulk/', {
      payload: {asset_uids: props.assetUids},
    }).then(() => {
      console.log('AAA delete done');
    }, handleApiFail);
  }

  return (
    <KoboPrompt
      // This is always open, because parent component is conditionally rendering it
      isOpen
      onRequestClose={props.onRequestClose}
      title={t('Delete ##count## projects').replace(
        '##count##',
        String(props.assetUids.length)
      )}
      buttons={[
        {
          type: 'frame',
          color: 'storm',
          label: 'Cancel',
          onClick: props.onRequestClose,
        },
        {
          type: 'full',
          color: 'red',
          label: 'Delete',
          onClick: onConfirmDelete,
          isDisabled: !isDataChecked || !isFormChecked || !isRecoverChecked,
        },
      ]}
    >
      <div className={styles.promptContent}>
        <p>
          {t('You are about to permanently delete ##count## projects').replace(
            '##count##',
            String(props.assetUids.length)
          )}
        </p>

        <Checkbox
          checked={isDataChecked}
          onChange={setIsDataChecked}
          label={t('All data gathered for these projects will be deleted')}
        />

        <Checkbox
          checked={isFormChecked}
          onChange={setIsFormChecked}
          label={t('Forms associated with these projects will be deleted')}
        />

        <strong>
          <Checkbox
            checked={isRecoverChecked}
            onChange={setIsRecoverChecked}
            label={t(
              'I understand that if I delete these projects I will not be able to recover them'
            )}
          />
        </strong>
      </div>
    </KoboPrompt>
  );
}
