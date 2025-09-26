import React, { useState, useEffect } from 'react'

import { endpoints } from '#/api.endpoints'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { ROOT_URL } from '#/constants'
import {
  HOME_DEFAULT_VISIBLE_FIELDS,
  HOME_EXCLUDED_FIELDS,
  HOME_ORDERABLE_FIELDS,
  ORG_VIEW,
} from './projectViews/constants'
import UniversalProjectsRoute from './universalProjectsRoute'

/**
 * Component responsible for rendering organization projects route
 * (`#/organization/projects`).
 */
export default function MyOrgProjectsRoute() {
  const [organization] = useOrganizationAssumed()
  const [apiUrl, setApiUrl] = useState<string | null>(null)

  // We need to load organization data to build the api url.
  useEffect(() => {
    setApiUrl(endpoints.ORG_ASSETS_URL.replace(':organization_id', organization.id))
  }, [organization.id])

  // Display spinner until everything is ready to go forward.
  if (!apiUrl) {
    return <LoadingSpinner />
  }

  return (
    <UniversalProjectsRoute
      viewUid={ORG_VIEW.uid}
      baseUrl={`${ROOT_URL}${apiUrl}`}
      defaultVisibleFields={HOME_DEFAULT_VISIBLE_FIELDS}
      includeTypeFilter
      defaultOrderableFields={HOME_ORDERABLE_FIELDS}
      defaultExcludedFields={HOME_EXCLUDED_FIELDS}
      isExportButtonVisible={false}
    />
  )
}
