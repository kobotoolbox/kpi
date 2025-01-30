// Libraries
import React from 'react';

// Partial components
import Button from 'js/components/common/button';

// Stores, hooks and utilities
import {getAssetDisplayName} from 'jsapp/js/assetUtils';
import {userCan} from 'js/components/permissions/utils';
import customViewStore from 'js/projects/customViewStore';

// Constants and types
import type {
  AssetResponse,
  ProjectViewAsset,
  DeploymentResponse,
} from 'js/dataInterface';
import {ASSET_TYPES} from 'js/constants';
import {
  archiveAsset,
  unarchiveAsset,
  deleteAsset,
  manageAssetSharing,
} from 'jsapp/js/assetQuickActions';

// Styles
import styles from './projectActions.module.scss';

interface ProjectQuickActionsProps {
  asset: AssetResponse | ProjectViewAsset;
}

/**
 * Quick Actions (Archive, Share, Delete) buttons. Use these when a single
 * project is selected in the Project Table.
 *
 * Note that for zero projects selected we display `ProjectQuickActionsEmpty`
 * instead.
 */
const ProjectQuickActions = ({asset}: ProjectQuickActionsProps) => {
  // The `userCan` method requires `permissions` property to be present in the
  // `asset` object. For performance reasons `ProjectViewAsset` doesn't have
  // that property, and it is fine, as we don't expect Project View to have
  // a lot of options available.
  const isChangingPossible = userCan('change_asset', asset);
  const isManagingPossible = userCan('manage_asset', asset);
  const isProjectViewAsset = !("permissions" in asset);

  return (
    <div className={styles.root}>
      {/* Archive / Unarchive */}
      {/* Archive a deployed project */}
      {asset.deployment_status === 'deployed' && (
        <Button
          isDisabled={
            !isChangingPossible ||
            asset.asset_type !== ASSET_TYPES.survey.id ||
            !asset.has_deployment
          }
          type='secondary'
          size='s'
          startIcon='archived'
          onClick={() =>
            archiveAsset(asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset);
            })
          }
          tooltip={t('Archive project')}
          tooltipPosition='right'
        />
      )}
      {/* Un-archive a deployed project */}
      {asset.deployment_status === 'archived' && (
        <Button
          isDisabled={
            !isChangingPossible ||
            asset.asset_type !== ASSET_TYPES.survey.id ||
            !asset.has_deployment
          }
          type='secondary'
          size='s'
          startIcon='archived'
          onClick={() =>
            unarchiveAsset(asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset);
            })
          }
          tooltip={t('Unarchive project')}
          tooltipPosition='right'
        />
      )}
      {/* Show tooltip, since drafts can't be archived/unarchived */}
      {asset.deployment_status === 'draft' && (
        <Button
          isDisabled
          type='secondary'
          size='s'
          startIcon='archived'
          tooltip={t('Draft project selected')}
          tooltipPosition='right'
        />
      )}

      {/* Share */}
      <Button
        isDisabled={!isManagingPossible && !isProjectViewAsset}
        type='secondary'
        size='s'
        startIcon='user-share'
        onClick={() => manageAssetSharing(asset.uid)}
        tooltip={t('Share project')}
        tooltipPosition='right'
      />

      {/* Delete */}
      <Button
        isDisabled={!isManagingPossible}
        type='secondary-danger'
        size='s'
        startIcon='trash'
        onClick={() =>
          deleteAsset(
            asset,
            getAssetDisplayName(asset).final,
            (deletedAssetUid: string) => {
              customViewStore.handleAssetsDeleted([deletedAssetUid]);
            }
          )
        }
        tooltip={
          isManagingPossible ? t('Delete 1 project') : t('Delete project')
        }
        tooltipPosition='right'
      />
    </div>
  );
}

export default ProjectQuickActions
