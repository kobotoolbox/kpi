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
  // Button is only fully disabled when no asset can be deleted at all.
  const canDeleteSome = isAdmin || props.assets.some((asset) => userCan('delete_asset', asset))
  // If some but not all assets are deletable, we show the blocker modal instead.
  const canDeleteAll = isAdmin || props.assets.every((asset) => userCan('delete_asset', asset))

  let tooltipForDelete = t('Delete projects')
  if (canDeleteSome) {
    tooltipForDelete = t('Delete ##count## projects').replace('##count##', String(props.assets.length))
  }

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
        isDisabled={!canDeleteSome}
        type='secondary-danger'
        size='s'
        startIcon='trash'
        onClick={() => openBulkDeleteModal(props.assets, { hasPermissionIssue: !canDeleteAll })}
        tooltip={tooltipForDelete}
        tooltipPosition='right'
      />
    </div>
  )
}
