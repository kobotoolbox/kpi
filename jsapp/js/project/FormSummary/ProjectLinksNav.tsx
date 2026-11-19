import React from 'react'
import { openEnketoPreviewModal } from '#/components/enketoPreview/openEnketoPreviewModal'
import { openSharingModal } from '#/components/permissions/openSharingModal'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { ROUTES } from '#/router/routerConstants'
import SummaryNavLink from './SummaryNavLink'
import SummarySection from './SummarySection'

interface ProjectLinksNavProps {
  asset: AssetResponse
}

/** Quick links to the most common project actions. */
export default function ProjectLinksNav({ asset }: ProjectLinksNavProps) {
  const canEdit = userCan('change_asset', asset)

  return (
    <SummarySection title={t('Quick Links')} component='nav'>
      {userCan('add_submissions', asset) && (
        <SummaryNavLink
          label={t('Collect data')}
          icon='k-icon k-icon-projects'
          to={ROUTES.FORM_LANDING.replace(':uid', asset.uid)}
        />
      )}

      {canEdit && (
        <SummaryNavLink
          label={t('Share project')}
          icon='k-icon k-icon-user-share'
          onClick={() => openSharingModal({ asset })}
        />
      )}

      {canEdit && (
        <SummaryNavLink
          label={t('Edit form')}
          icon='k-icon k-icon-edit'
          to={ROUTES.FORM_EDIT.replace(':uid', asset.uid)}
        />
      )}

      <SummaryNavLink
        label={t('Preview form')}
        icon='k-icon k-icon-view'
        onClick={() => openEnketoPreviewModal({ assetUrl: asset.url })}
        disabled={!asset.url}
      />
    </SummarySection>
  )
}
