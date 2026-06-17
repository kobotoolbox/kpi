import React from 'react'

import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import { openBulkDeleteModal } from './bulkActions/openBulkDeleteModal'
import actionsStyles from './projectActions.module.scss'

interface ProjectBulkActionsProps {
  /** A list of selected assets for bulk operations. */
  assets: Array<AssetResponse | ProjectViewAsset>
}

/**
 * "Bulk" Quick Actions buttons. Use these when two or more projects are
 * selected in the Project Table.
 */
export default function ProjectBulkActions(props: ProjectBulkActionsProps) {
  const [organization] = useOrganizationAssumed()
  const isAdmin = organization.request_user_role === MemberRoleEnum.admin
  const isMmoMember = organization.is_mmo && organization.request_user_role === MemberRoleEnum.member

  // Button is enabled for anyone who may see either the confirm or blocker modal.
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
        onClick={() => openBulkDeleteModal(props.assets)}
        tooltip={tooltipForDelete}
        tooltipPosition='right'
      />
    </div>
  )
}
