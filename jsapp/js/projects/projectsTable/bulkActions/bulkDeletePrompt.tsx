import React, {useState} from 'react';
import {fetchPost} from 'js/api';
import {handleApiFail} from 'js/utils';
import KoboPrompt from 'js/components/modals/koboPrompt';
import Checkbox from 'js/components/common/checkbox';
import styles from './bulkDeletePrompt.module.scss';
import customViewStore from 'js/projects/customViewStore';

interface BulkDeletePromptProps {
  assetUids: string[];
  /** Being used by the parent component to close the prompt. */
  onRequestClose: () => void;
}

type AssetsBulkAction = 'archive' | 'delete' | 'unarchive';

export default function BulkDeletePrompt(props: BulkDeletePromptProps) {
  const [isDataChecked, setIsDataChecked] = useState(false);
  const [isFormChecked, setIsFormChecked] = useState(false);
  const [isRecoverChecked, setIsRecoverChecked] = useState(false);
  const [isConfirmDeletePending, setIsConfirmDeletePending] = useState(false);

  function onConfirmDelete() {
    setIsConfirmDeletePending(true);

    const payload: {asset_uids: string[]; action: AssetsBulkAction} = {
      asset_uids: props.assetUids,
      action: 'delete',
    };

    fetchPost('/api/v2/assets/bulk/', {payload: payload})
      .then((data: any) => {
        props.onRequestClose();
        customViewStore.handleAssetsDeleted(props.assetUids);
        console.log('AAA delete done', data);
      })
      .catch(handleApiFail);
  }

  return (
    <KoboPrompt
      // This is always open, because parent is conditionally rendering this component
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
          isDisabled: isConfirmDeletePending,
        },
        {
          type: 'full',
          color: 'red',
          label: 'Delete',
          onClick: onConfirmDelete,
          isDisabled: !isDataChecked || !isFormChecked || !isRecoverChecked,
          isPending: isConfirmDeletePending,
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
