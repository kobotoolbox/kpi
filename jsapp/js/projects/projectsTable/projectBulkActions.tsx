// Libraries
import React, {useState} from 'react';

// Partial components
import Button from 'js/components/common/button';
import BulkDeletePrompt from './bulkActions/bulkDeletePrompt';

// Stores, hooks and utilities
import {userCan} from 'js/components/permissions/utils';

// Constants and types
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';

// Styles
import actionsStyles from './projectActions.module.scss';

interface ProjectBulkActionsProps {
  /** A list of selected assets for bulk operations. */
  assets: Array<AssetResponse | ProjectViewAsset>;
}

function userCanDeleteAssets(assets: Array<AssetResponse | ProjectViewAsset>) {
  return assets.every((asset) => userCan('manage_asset', asset));
}

/**
 * "Bulk" Quick Actions buttons. Use these when two or more projects are
 * selected in the Project Table.
 */
export default function ProjectBulkActions(props: ProjectBulkActionsProps) {
  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false);
  const canBulkDelete = userCanDeleteAssets(props.assets);

  let tooltipForDelete = t('Delete projects');
  if (canBulkDelete) {
    tooltipForDelete = t('Delete ##count## projects').replace(
      '##count##',
      String(props.assets.length)
    );
  }

  return (
    <div className={actionsStyles.root}>
      {/* Archive / Unarchive - Bulk action not supported yet */}
      <Button
        isDisabled
        type='secondary'
        size='s'
        startIcon='archived'
        tooltip={t('Archive/Unarchive')}
        tooltipPosition='right'
      />

      {/* Share - Bulk action not supported yet */}
      <Button
        isDisabled
        type='secondary'
        size='s'
        startIcon='user-share'
        tooltip={t('Share projects')}
        tooltipPosition='right'
      />

      {/* Delete */}
      <Button
        isDisabled={!canBulkDelete}
        type='secondary-danger'
        size='s'
        startIcon='trash'
        onClick={() => setIsDeletePromptOpen(true)}
        tooltip={tooltipForDelete}
        tooltipPosition='right'
      />

      {isDeletePromptOpen && (
        <BulkDeletePrompt
          assetUids={props.assets.map((asset) => asset.uid)}
          onRequestClose={() => setIsDeletePromptOpen(false)}
        />
      )}
    </div>
  );
}
