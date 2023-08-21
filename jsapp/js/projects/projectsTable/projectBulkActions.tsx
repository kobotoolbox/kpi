import React, {useState} from 'react';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';
import Button from 'js/components/common/button';
import actionsStyles from './projectActions.module.scss';
import BulkDeletePrompt from './bulkActions/bulkDeletePrompt';
import {userCan} from 'js/components/permissions/utils';

interface ProjectBulkActionsProps {
  /** A list of selected assets for bulk operations. */
  assets: Array<AssetResponse | ProjectViewAsset>;
}

function userCanDeleteAssets(assets: Array<AssetResponse | ProjectViewAsset>) {
  return assets.every((asset) => userCan('manage_asset', asset));
}

export default function ProjectBulkActions(props: ProjectBulkActionsProps) {
  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false);
  const canBulkDelete = userCanDeleteAssets(props.assets);

  return (
    <div className={actionsStyles.root}>
      {/* Archive / Unarchive - Bulk action not supported yet */}
      <Button
        isDisabled
        type='bare'
        color='storm'
        size='s'
        startIcon='archived'
        tooltip={t('Archive/Unarchive')}
        classNames={['right-tooltip']}
      />

      {/* Share - Bulk action not supported yet */}
      <Button
        isDisabled
        type='bare'
        color='storm'
        size='s'
        startIcon='user-share'
        tooltip={t('Share projects')}
        classNames={['right-tooltip']}
      />

      {/* Delete */}
      {canBulkDelete ? (
        <Button
          type='bare'
          color='storm'
          size='s'
          startIcon='trash'
          tooltip={t('Delete ##count## projects').replace(
            '##count##',
            String(props.assets.length)
          )}
          onClick={() => setIsDeletePromptOpen(true)}
          classNames={['right-tooltip']}
        />
      ) : (
        <Button
          isDisabled
          type='bare'
          color='storm'
          size='s'
          startIcon='trash'
          tooltip={t('Delete projects')}
          classNames={['right-tooltip']}
        />
      )}

      {isDeletePromptOpen && (
        <BulkDeletePrompt
          assetUids={props.assets.map((asset) => asset.uid)}
          onRequestClose={() => setIsDeletePromptOpen(false)}
        />
      )}
    </div>
  );
}
