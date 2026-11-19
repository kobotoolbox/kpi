import React from 'react'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { getFormDataTabs } from '#/project/FormViewSideTabs.utils'
import SummaryNavLink from './SummaryNavLink'
import SummarySection from './SummarySection'

interface ProjectDataNavProps {
  asset: AssetResponse
}

/** Links to the project data routes. Hidden until there is some data to see. */
export default function ProjectDataNav({ asset }: ProjectDataNavProps) {
  if (!userCan('view_submissions', asset) || asset.deployment__submission_count < 1) {
    return null
  }

  return (
    <SummarySection title={t('Data')} component='nav'>
      {getFormDataTabs(asset.uid).map((tab) => (
        <SummaryNavLink key={tab.path} label={tab.label} icon={tab.icon} to={tab.path} />
      ))}
    </SummarySection>
  )
}
