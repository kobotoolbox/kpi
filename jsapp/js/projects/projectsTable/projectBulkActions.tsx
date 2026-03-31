import React, { useState } from 'react'

import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import BulkArchivePrompt from './bulkActions/bulkArchivePrompt'
import BulkDeletePrompt from './bulkActions/bulkDeletePrompt'
import actionsStyles from './projectActions.module.scss'

interface ProjectBulkActionsProps {
  /** A list of selected assets for bulk operations. */
  assets: Array<AssetResponse | ProjectViewAsset>
}

function userCanDeleteAssets(assets: Array<AssetResponse | ProjectViewAsset>) {
  return assets.every((asset) => userCan('manage_asset', asset))
}

function userCanArchiveAssets(assets: Array<AssetResponse | ProjectViewAsset>) {
  return assets.every((asset) => userCan('change_asset', asset))
}

/**
 * "Bulk" Quick Actions buttons. Use these when two or more projects are
 * selected in the Project Table.
 */
export default function ProjectBulkActions(props: ProjectBulkActionsProps) {
  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false)
  const [isArchivePromptOpen, setIsArchivePromptOpen] = useState(false)
  const [organization] = useOrganizationAssumed()
  const canBulkDelete = userCanDeleteAssets(props.assets) || organization.request_user_role === MemberRoleEnum.admin

  const deploymentStatuses = props.assets.map((asset) => asset.deployment_status)
  const allDeployed = deploymentStatuses.every((s) => s === 'deployed')
  const allArchived = deploymentStatuses.every((s) => s === 'archived')
  const bulkArchiveAction = allDeployed ? 'archive' : allArchived ? 'unarchive' : undefined
  const canBulkArchive = userCanArchiveAssets(props.assets) && bulkArchiveAction !== undefined

  let tooltipForArchive = t('Archive/Unarchive')
  if (canBulkArchive) {
    const label = bulkArchiveAction === 'archive' ? t('Archive ##count## projects') : t('Unarchive ##count## projects')
    tooltipForArchive = label.replace('##count##', String(props.assets.length))
  }

  let tooltipForDelete = t('Delete projects')
  if (canBulkDelete) {
    tooltipForDelete = t('Delete ##count## projects').replace('##count##', String(props.assets.length))
  }

  return (
    <div className={actionsStyles.root}>
      {/* Archive / Unarchive */}
      <Button
        isDisabled={!canBulkArchive}
        type='secondary'
        size='s'
        startIcon='archived'
        onClick={() => setIsArchivePromptOpen(true)}
        tooltip={tooltipForArchive}
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

      {isArchivePromptOpen && bulkArchiveAction && (
        <BulkArchivePrompt
          assetUids={props.assets.map((asset) => asset.uid)}
          action={bulkArchiveAction}
          onRequestClose={() => setIsArchivePromptOpen(false)}
        />
      )}

      {isDeletePromptOpen && (
        <BulkDeletePrompt
          assetUids={props.assets.map((asset) => asset.uid)}
          onRequestClose={() => setIsDeletePromptOpen(false)}
        />
      )}
    </div>
  )
}
