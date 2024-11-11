// Libraries
import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

// Partial components
import UniversalProjectsRoute from './universalProjectsRoute';
import LoadingSpinner from 'js/components/common/loadingSpinner';

// Stores, hooks and utilities
import {useOrganizationQuery} from 'js/account/stripe.api';

// Constants and types
import {
  ORG_VIEW,
  HOME_ORDERABLE_FIELDS,
  HOME_DEFAULT_VISIBLE_FIELDS,
  HOME_EXCLUDED_FIELDS,
} from './projectViews/constants';
import {ROOT_URL} from 'js/constants';
import {endpoints} from 'js/api.endpoints';
import {PROJECTS_ROUTES} from 'js/router/routerConstants';

/**
 * Component responsible for rendering organization projects route
 * (`#/organization/projects`).
 */
export default function MyOrgProjectsRoute() {
  const orgQuery = useOrganizationQuery();
  const navigate = useNavigate();
  const [apiUrl, setApiUrl] = useState<string | null>(null);

  // We need to load organization data to build the api url.
  useEffect(() => {
    if (orgQuery.data) {
      setApiUrl(endpoints.ORG_ASSETS_URL.replace(':organization_uid', orgQuery.data.id));
    }
  }, [orgQuery.data]);

  // If user visits organization projects route and the organization is not MMO
  // we redirect user out of here.
  useEffect(() => {
    if (orgQuery.data?.is_mmo === false) {
      navigate(PROJECTS_ROUTES.MY_PROJECTS);
    }
  }, [navigate, orgQuery.data]);

  // Display spinner until everything is ready to go forward.
  if (!apiUrl) {
    return <LoadingSpinner />;
  }

  return (
    <UniversalProjectsRoute
      viewUid={ORG_VIEW.uid}
      baseUrl={`${ROOT_URL}${apiUrl}`}
      defaultVisibleFields={HOME_DEFAULT_VISIBLE_FIELDS}
      includeTypeFilter={false}
      defaultOrderableFields={HOME_ORDERABLE_FIELDS}
      defaultExcludedFields={HOME_EXCLUDED_FIELDS}
      isExportButtonVisible={false}
    />
  );
}
