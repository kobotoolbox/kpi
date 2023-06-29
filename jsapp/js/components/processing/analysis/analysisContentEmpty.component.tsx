import React from 'react';
import styles from './analysisContentEmpty.module.scss';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import assetStore from 'js/assetStore';
import {userCan} from 'js/components/permissions/utils';
import InlineMessage from 'js/components/common/inlineMessage';
import Icon from 'js/components/common/icon';

/** To bedisplayed when there are no questions defined yet. */
export default function AnalysisContentEmpty() {
  const hasManagePermissions = (() => {
    const asset = assetStore.getAsset(singleProcessingStore.currentAssetUid);
    return userCan('manage_asset', asset);
  })();

  if (hasManagePermissions) {
    return (
      <div className={styles.root}>
        <InlineMessage
          icon='alert'
          type='warning'
          message={t(
            'Please note that any qualitative question created for this record will generate a new column in the data table, making the question available for all other records.'
          )}
        />

        <p>{t('There are no qualitative analysis questions yet.')}</p>

        <p>{t('Click the "Add question" button to get started')}</p>
      </div>
    );
  } else {
    return (
      <div className={styles.root}>
        <p>{t('There are no qualitative analysis questions yet.')}</p>

        <p>
          <Icon name='lock-alt' size='xl' classNames={[styles.lockIcon]} />
        </p>

        <p>
          <strong>
            {t('Only those with full editing rights can create questions')}
          </strong>
        </p>
        <p>{t('Contact the project owner for more information')}</p>
      </div>
    );
  }
}
