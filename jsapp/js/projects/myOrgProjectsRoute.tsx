// Libraries
import React, {useState, useEffect} from 'react';

// Partial components
import UniversalProjectsRoute from './universalProjectsRoute';
import LoadingSpinner from 'js/components/common/loadingSpinner';

// Stores, hooks and utilities
import {useOrganizationQuery} from 'js/account/organization/organizationQuery';

// Constants and types
import {
  ORG_VIEW,
  HOME_ORDERABLE_FIELDS,
  HOME_DEFAULT_VISIBLE_FIELDS,
  HOME_EXCLUDED_FIELDS,
} from './projectViews/constants';
import {ROOT_URL} from 'js/constants';
import {endpoints} from 'js/api.endpoints';

/**
 * Component responsible for rendering organization projects route
 * (`#/organization/projects`).
 */
export default function MyOrgProjectsRoute() {
  const orgQuery = useOrganizationQuery();
  const [apiUrl, setApiUrl] = useState<string | null>(null);

  // We need to load organization data to build the api url.
  useEffect(() => {
    if (orgQuery.data) {
      setApiUrl(endpoints.ORG_ASSETS_URL.replace(':organization_id', orgQuery.data.id));
    }
  }, [orgQuery.data]);

  // Display spinner until everything is ready to go forward.
  if (!apiUrl) {
    return <LoadingSpinner />;
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
  );
}
