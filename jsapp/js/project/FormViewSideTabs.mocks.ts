import { reactRouterParameters } from 'storybook-addon-remix-react-router'
import type { Asset } from '#/api/models/asset'
import { getAssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content/msw'
import { meMockResponse } from '#/endpoints/me.mocks'
import { ROUTES } from '#/router/routerConstants'

export const SIDE_TABS_ASSET_UID = 'aFormViewSideTabsStory'

/** A deployed project owned by the story user, so every tab shows. */
export function buildSideTabsAsset(overrides: Partial<Asset> = {}): Asset {
  return getAssetsRetrieveResponseMock({
    uid: SIDE_TABS_ASSET_UID,
    owner__username: meMockResponse.username,
    has_deployment: true,
    deployment__active: true,
    deployed_versions: { count: 1, next: null, previous: null, results: [] },
    permissions: [],
    effective_permissions: [],
    ...overrides,
  })
}

/** Router parameters for a project route, e.g. `ROUTES.FORM_TABLE`. */
export function sideTabsRouteParameters(route: string) {
  return reactRouterParameters({
    location: { path: route.replace(':uid', SIDE_TABS_ASSET_UID) },
    routing: { path: `${ROUTES.FORM}/*` },
  })
}
