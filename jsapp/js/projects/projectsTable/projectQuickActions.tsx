import React from 'react'

import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import { archiveAsset, manageAssetSharing, unarchiveAsset } from '#/assetQuickActions'
import { getAssetDisplayName } from '#/assetUtils'
import { openDeleteAssetModal } from '#/components/DeleteAssetModal/openDeleteAssetModal'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse, DeploymentResponse, ProjectViewAsset } from '#/dataInterface'
import customViewStore from '#/projects/customViewStore'
import sessionStore from '#/stores/session'
import { openBulkDeleteModal } from './bulkActions/openBulkDeleteModal'
import styles from './projectActions.module.scss'

interface ProjectQuickActionsProps {
  asset: AssetResponse | ProjectViewAsset
}

/**
 * Quick Actions (Archive, Share, Delete) buttons. Use these when a single
 * project is selected in the Project Table.
 *
 * Note that for zero projects selected we display `ProjectQuickActionsEmpty`
 * instead.
 */
const ProjectQuickActions = ({ asset }: ProjectQuickActionsProps) => {
  const [organization] = useOrganizationAssumed()
  const currentUsername = sessionStore.currentAccount.username

  // The `userCan` method requires `permissions` property to be present in the
  // `asset` object. For performance reasons `ProjectViewAsset` doesn't have
  // that property, and it is fine, as we don't expect Project View to have
  // a lot of options available.
  const isChangingPossible = userCan('change_asset', asset)
  const isManagingPossible = userCan('manage_asset', asset) || organization.request_user_role === MemberRoleEnum.admin
  const isProjectViewAsset = !('permissions' in asset)
  const isAdmin = organization.request_user_role === MemberRoleEnum.admin
  const isMmoMember = organization.is_mmo && organization.request_user_role === MemberRoleEnum.member

  const canMmoMemberDelete =
    isMmoMember &&
    userCan('manage_asset', asset) &&
    !!asset.created_by &&
    asset.created_by === currentUsername &&
    (asset.deployment__submission_count ?? 0) === 0

  const isDeletingPossible = userCan('delete_asset', asset) || isAdmin || canMmoMemberDelete

  // MMO members with manage_asset can open the flow even if they can't delete,
  // so they see the appropriate blocker modal.
  const canOpenDeleteFlow = isDeletingPossible || (isMmoMember && userCan('manage_asset', asset))

  function handleDelete() {
    if (isDeletingPossible) {
      openDeleteAssetModal(asset, getAssetDisplayName(asset).final, (deletedAssetUid: string) => {
        customViewStore.handleAssetsDeleted([deletedAssetUid])
      })
    } else {
      const blockerReason = (asset.deployment__submission_count ?? 0) > 0 ? 'submissions' : 'permissions'
      openBulkDeleteModal([asset], { blockerReason })
    }
  }

  return (
    <div className={styles.root}>
      {/* Archive / Unarchive */}
      {/* Archive a deployed project */}
      {asset.deployment_status === 'deployed' && (
        <Button
          isDisabled={!isChangingPossible || asset.asset_type !== ASSET_TYPES.survey.id || !asset.has_deployment}
          type='secondary'
          size='s'
          startIcon='archived'
          onClick={() =>
            archiveAsset(asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset)
            })
          }
          tooltip={t('Archive project')}
          tooltipPosition='right'
        />
      )}
      {/* Un-archive a deployed project */}
      {asset.deployment_status === 'archived' && (
        <Button
          isDisabled={!isChangingPossible || asset.asset_type !== ASSET_TYPES.survey.id || !asset.has_deployment}
          type='secondary'
          size='s'
          startIcon='archived'
          onClick={() =>
            unarchiveAsset(asset, (response: DeploymentResponse) => {
              customViewStore.handleAssetChanged(response.asset)
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
        isDisabled={!canOpenDeleteFlow}
        type='secondary-danger'
        size='s'
        startIcon='trash'
        onClick={handleDelete}
        tooltip={canOpenDeleteFlow ? t('Delete 1 project') : t('Delete project')}
        tooltipPosition='right'
      />
    </div>
  )
}

export default ProjectQuickActions
