import React from 'react'

import { ROOT_URL } from '#/constants'
import {
  HOME_DEFAULT_VISIBLE_FIELDS,
  HOME_EXCLUDED_FIELDS,
  HOME_ORDERABLE_FIELDS,
  HOME_VIEW,
} from './projectViews/constants'
import UniversalProjectsRoute from './universalProjectsRoute'

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
  )
}
