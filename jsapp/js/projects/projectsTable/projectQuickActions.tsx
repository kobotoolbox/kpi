import React from 'react';
import type {
  AssetResponse,
  ProjectViewAsset,
  DeploymentResponse,
} from 'js/dataInterface';
import {ASSET_TYPES} from 'js/constants';
import Button from 'js/components/common/button';
import styles from './projectActions.module.scss';
import {getAssetDisplayName} from 'jsapp/js/assetUtils';
import {
  archiveAsset,
  unarchiveAsset,
  deleteAsset,
  manageAssetSharing,
} from 'jsapp/js/assetQuickActions';
import {userCan} from 'js/components/permissions/utils';
import customViewStore from 'js/projects/customViewStore';

interface ProjectQuickActionsProps {
  asset: AssetResponse | ProjectViewAsset;
}

export default function ProjectQuickActions(props: ProjectQuickActionsProps) {
  // The `userCan` method requires `permissions` property to be present in the
  // `asset` object. For performance reasons `ProjectViewAsset` doesn't have
  // that property, and it is fine, as we don't expect Project View to have
  // a lot of options available.
  const isChangingPossible = userCan('change_asset', props.asset);
  const isManagingPossible = userCan('manage_asset', props.asset);

  return (
    <div className={styles.root}>
      {/* Archive / Unarchive */}
      {/* Archive a deployed project */}
      {props.asset.deployment_status === 'deployed' && (
        <Button
          isDisabled={
            !isChangingPossible ||
            props.asset.asset_type !== ASSET_TYPES.survey.id ||
            !props.asset.has_deployment
          }
          type='bare'
          color='storm'
          size='s'
          startIcon='archived'
          tooltip={t('Archive project')}
          onClick={() =>
            archiveAsset(props.asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset);
            })
          }
          classNames={['right-tooltip']}
        />
      )}
      {/* Un-archive a deployed project */}
      {props.asset.deployment_status === 'archived' && (
        <Button
          isDisabled={
            !isChangingPossible ||
            props.asset.asset_type !== ASSET_TYPES.survey.id ||
            !props.asset.has_deployment
          }
          type='bare'
          color='storm'
          size='s'
          startIcon='archived'
          tooltip={t('Unarchive project')}
          onClick={() =>
            unarchiveAsset(props.asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset);
            })
          }
          classNames={['right-tooltip']}
        />
      )}
      {/* Show tooltip, since drafts can't be archived/unarchived */}
      {props.asset.deployment_status === 'draft' && (
        <Button
          isDisabled
          type='bare'
          color='storm'
          size='s'
          startIcon='archived'
          tooltip={t('Draft project selected')}
          classNames={['right-tooltip']}
        />
      )}

      {/* Share */}
      <Button
        isDisabled={!isManagingPossible}
        type='bare'
        color='storm'
        size='s'
        startIcon='user-share'
        tooltip={t('Share project')}
        onClick={() => manageAssetSharing(props.asset.uid)}
        classNames={['right-tooltip']}
      />

      {/* Delete */}
      <Button
        isDisabled={!isChangingPossible}
        type='bare'
        color='storm'
        size='s'
        startIcon='trash'
        tooltip={t('Delete')}
        onClick={() =>
          deleteAsset(
            props.asset,
            getAssetDisplayName(props.asset).final,
            (deletedAssetUid: string) => {
              customViewStore.handleAssetsDeleted([deletedAssetUid]);
            }
          )
        }
        classNames={['right-tooltip']}
      />
    </div>
  );
}
