// Libraries
import React from 'react';

// Partial components
import UniversalProjectsRoute from './universalProjectsRoute';

// Constants and types
import {
  HOME_VIEW,
  HOME_ORDERABLE_FIELDS,
  HOME_DEFAULT_VISIBLE_FIELDS,
  HOME_EXCLUDED_FIELDS,
} from './projectViews/constants';
import {ROOT_URL} from 'js/constants';

/**
 * Component responsible for rendering "My projects" route (`#/projects/home`).
 */
export default function MyProjectsRoute() {
  return (
    <UniversalProjectsRoute
      viewUid={HOME_VIEW.uid}
      baseUrl={`${ROOT_URL}/api/v2/assets/`}
      defaultVisibleFields={HOME_DEFAULT_VISIBLE_FIELDS}
      includeTypeFilter
      defaultOrderableFields={HOME_ORDERABLE_FIELDS}
      defaultExcludedFields={HOME_EXCLUDED_FIELDS}
      isExportButtonVisible={false}
    />
  );
}
