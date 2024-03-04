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

/**
 * Quick Actions (Archive, Share, Delete) buttons. Use these when a single
 * project is selected in the Project Table.
 */
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
          onClick={() =>
            archiveAsset(props.asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset);
            })
          }
          tooltip={t('Archive project')}
          tooltipPosition='right'
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
          onClick={() =>
            unarchiveAsset(props.asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset);
            })
          }
          tooltip={t('Unarchive project')}
          tooltipPosition='right'
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
          tooltipPosition='right'
        />
      )}

      {/* Share */}
      <Button
        isDisabled={!isManagingPossible}
        type='bare'
        color='storm'
        size='s'
        startIcon='user-share'
        onClick={() => manageAssetSharing(props.asset.uid)}
        tooltip={t('Share project')}
        tooltipPosition='right'
      />

      {/* Delete */}
      <Button
        isDisabled={!isChangingPossible}
        type='bare'
        color='storm'
        size='s'
        startIcon='trash'
        onClick={() =>
          deleteAsset(
            props.asset,
            getAssetDisplayName(props.asset).final,
            (deletedAssetUid: string) => {
              customViewStore.handleAssetsDeleted([deletedAssetUid]);
            }
          )
        }
        tooltip={
          isChangingPossible ? t('Delete 1 project') : t('Delete project')
        }
        tooltipPosition='right'
      />
    </div>
  );
}
