import React from 'react';
import {fetchDelete} from 'js/api';
import type {
  AssetResponse,
  ProjectViewAsset,
} from 'js/dataInterface';
import Button from 'js/components/common/button';
import actionsStyles from './projectActions.module.scss';
import {handleApiFail} from 'jsapp/js/utils';

interface ProjectBulkActionsProps {
  assets: Array<AssetResponse | ProjectViewAsset>;
}

export default function ProjectBulkActions(props: ProjectBulkActionsProps) {
  function deleteSelectedAssets() {
    const uids = props.assets.map((asset) => asset.uid);
    console.log('AAA delete selected assets', uids);

    fetchDelete(
      '/api/v2/assets/bulk/',
      {payload: {asset_uids: uids}}
    ).then(() => {
      console.log('AAA delete done');
    }, handleApiFail);
  }

  return (
    <div className={actionsStyles.root}>
      <Button
        type='bare'
        color='storm'
        size='s'
        startIcon='trash'
        tooltip={t('Delete ##number## projects').replace('##number##', String(props.assets.length))}
        onClick={() => deleteSelectedAssets()}
      />
    </div>
  );
}
