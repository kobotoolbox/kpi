import React, { useState, useEffect } from 'react'

import { useOrganizationQuery } from '#/account/organization/organizationQuery'
import { endpoints } from '#/api.endpoints'
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
  const orgQuery = useOrganizationQuery()
  const [apiUrl, setApiUrl] = useState<string | null>(null)

  // We need to load organization data to build the api url.
  useEffect(() => {
    if (orgQuery.data) {
      setApiUrl(endpoints.ORG_ASSETS_URL.replace(':organization_id', orgQuery.data.id))
    }
  }, [orgQuery.data])

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
