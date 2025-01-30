// Libraries
import React, {useState} from 'react';

// Partial components
import KoboPrompt from 'js/components/modals/koboPrompt';
import Checkbox from 'js/components/common/checkbox';

// Stores, hooks and utilities
import {fetchPost, handleApiFail} from 'js/api';
import {notify} from 'js/utils';
import customViewStore from 'js/projects/customViewStore';
import {searches} from 'js/searches';

// Styles
import styles from './bulkDeletePrompt.module.scss';

type AssetsBulkAction = 'archive' | 'delete' | 'unarchive';
interface AssetsBulkResponse {
  detail: string;
}

interface BulkDeletePromptProps {
  assetUids: string[];
  /** Being used by the parent component to close the prompt. */
  onRequestClose: () => void;
}

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

    fetchPost<AssetsBulkResponse>('/api/v2/assets/bulk/', {payload: payload})
      .then((response) => {
        props.onRequestClose();
        customViewStore.handleAssetsDeleted(props.assetUids);

        // Temporarily we do this hacky thing to update the sidebar list of
        // projects. After the Bookmarked Projects feature is done (see the
        // https://github.com/kobotoolbox/kpi/issues/4220 for history of
        // discussion and more details) we would remove this code.
        searches.forceRefreshFormsList();

        notify(response.detail);
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
          type: 'secondary',
          label: 'Cancel',
          onClick: props.onRequestClose,
          isDisabled: isConfirmDeletePending,
        },
        {
          type: 'danger',
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
