import React, {useState} from 'react';
import type {
  AssetResponse,
  ProjectViewAsset,
} from 'js/dataInterface';
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
      <Button
        type='bare'
        color='storm'
        size='s'
        startIcon='trash'
        tooltip={t('Delete ##count## projects').replace('##count##', String(props.assets.length))}
        onClick={() => setIsDeletePromptOpen(true)}
      />

      {isDeletePromptOpen &&
        <BulkDeletePrompt
          assetUids={props.assets.map((asset) => asset.uid)}
          onRequestClose={() => setIsDeletePromptOpen(false)}
        />
      }
    </div>
  );
}
