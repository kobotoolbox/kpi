import React, {useState} from 'react';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';
import Button from 'js/components/common/button';
import actionsStyles from './projectActions.module.scss';
import BulkDeletePrompt from './bulkActions/bulkDeletePrompt';

interface ProjectBulkActionsProps {
  /** A list of selected assets for bulk operations. */
  assets: Array<AssetResponse | ProjectViewAsset>;
}

export default function ProjectBulkActions(props: ProjectBulkActionsProps) {
  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false);

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

      {isDeletePromptOpen && (
        <BulkDeletePrompt
          assetUids={props.assets.map((asset) => asset.uid)}
          onRequestClose={() => setIsDeletePromptOpen(false)}
        />
      )}
    </div>
  );
}
