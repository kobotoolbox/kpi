import React from 'react'

import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import sessionStore from '#/stores/session'
import { openBulkDeleteModal } from './bulkActions/openBulkDeleteModal'
import actionsStyles from './projectActions.module.scss'

interface ProjectBulkActionsProps {
  /** A list of selected assets for bulk operations. */
  assets: Array<AssetResponse | ProjectViewAsset>
}

function getDeleteBlockerReason(
  assets: Array<AssetResponse | ProjectViewAsset>,
  isMmoMember: boolean,
  isAdmin: boolean,
  currentUsername: string,
): 'submissions' | 'permissions' | undefined {
  if (isAdmin) {
    return undefined
  }

  if (isMmoMember) {
    if (assets.some((asset) => (asset.deployment__submission_count ?? 0) > 0)) {
      return 'submissions'
    }
    if (
      assets.some(
        (asset) => !asset.created_by || asset.created_by !== currentUsername || !userCan('manage_asset', asset),
      )
    ) {
      return 'permissions'
    }
    return undefined
  }

  if (!assets.every((asset) => userCan('delete_asset', asset))) {
    return 'permissions'
  }
  return undefined
}

/**
 * "Bulk" Quick Actions buttons. Use these when two or more projects are
 * selected in the Project Table.
 */
export default function ProjectBulkActions(props: ProjectBulkActionsProps) {
  const [organization] = useOrganizationAssumed()
  const currentUsername = sessionStore.currentAccount.username
  const isAdmin = organization.request_user_role === MemberRoleEnum.admin
  const isMmoMember = organization.is_mmo && organization.request_user_role === MemberRoleEnum.member

  const blockerReason = getDeleteBlockerReason(props.assets, isMmoMember, isAdmin, currentUsername)

  // For MMO members: enable button if they have manage_asset on all selected projects.
  // For others: enable if they have delete_asset on at least one.
  const canOpenDeleteModal =
    isAdmin ||
    (isMmoMember
      ? props.assets.every((asset) => userCan('manage_asset', asset))
      : props.assets.some((asset) => userCan('delete_asset', asset)))

  const tooltipForDelete = canOpenDeleteModal
    ? t('Delete ##count## projects').replace('##count##', String(props.assets.length))
    : t('Delete projects')

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
        isDisabled={!canOpenDeleteModal}
        type='secondary-danger'
        size='s'
        startIcon='trash'
        onClick={() => openBulkDeleteModal(props.assets, { blockerReason })}
        tooltip={tooltipForDelete}
        tooltipPosition='right'
      />
    </div>
  )
}
