// Libraries
import React from 'react';
import {useParams} from 'react-router-dom';

// Partial components
import UniversalProjectsRoute from './universalProjectsRoute';

// Constants and types
import {
  DEFAULT_VISIBLE_FIELDS,
  DEFAULT_ORDERABLE_FIELDS,
  DEFAULT_EXCLUDED_FIELDS,
} from './projectViews/constants';
import {ROOT_URL} from 'js/constants';

/**
 * Component responsible for rendering a custom project view route (`#/projects/<vid>`).
 */
export default function CustomViewRoute() {
  const {viewUid} = useParams();

  // This condition is here to satisfy TS, as without it the code below would
  // need to be unnecessarily more lengthy.
  if (viewUid === undefined) {
    return null;
  }

  return (
    <UniversalProjectsRoute
      viewUid={viewUid}
      baseUrl={`${ROOT_URL}/api/v2/project-views/${viewUid}/assets/`}
      defaultVisibleFields={DEFAULT_VISIBLE_FIELDS}
      includeTypeFilter={false}
      defaultOrderableFields={DEFAULT_ORDERABLE_FIELDS}
      defaultExcludedFields={DEFAULT_EXCLUDED_FIELDS}
      isExportButtonVisible
    />
  );
}
