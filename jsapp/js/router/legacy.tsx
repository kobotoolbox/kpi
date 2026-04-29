/** Don't use anything here for new components */
import React, { type FC } from 'react'

import type { DataRouter as Router } from 'react-router'
import type { Location, NavigateFunction, Params } from 'react-router-dom'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { recordEntries, recordKeys } from '#/utils'

// https://stackoverflow.com/a/70754791/443457
/**
 * @deprecated Use `getCurrentPath` from `routerUtils.ts`.
 */
const getRoutePath = (location: Location, params: Params): string => {
  const { pathname } = location

  if (!recordKeys(params).length) {
    return pathname // we don't need to replace anything
  }

  let path = pathname
  recordEntries(params).forEach(([paramName, paramValue]) => {
    if (paramValue) {
      path = path.replace(paramValue, `:${paramName}`)
    }
  })
  return path
}

export interface RouterProp {
  location: Location
  navigate: NavigateFunction
  params: Readonly<Params<string>>
  searchParams: URLSearchParams // Replaces props.location.query
  path: string // Replaces props.route.path
}

export interface WithRouterProps {
  router: RouterProp
  params: Readonly<Params<string>> // Defined as props twice for compat!
}

/**
 * This is for class based components, which cannot use hooks
 * Attempts to mimic both react router 3 and 5!
 * https://v5.reactrouter.com/web/api/withRouter
 *
 * @deprecated Use hooks instead when possible.
 */
export function withRouter(Component: FC | typeof React.Component) {
  function ComponentWithRouterProp(props: any) {
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams, _] = useSearchParams()
    const params = useParams()
    const path = getRoutePath(location, params)
    const router: RouterProp = { location, navigate, params, searchParams, path }
    return <Component {...props} params={params} router={router} />
  }

  return ComponentWithRouterProp
}

/**
 * Necessary to avoid circular dependency
 * Because router may be null, non-component uses may need to check
 * null status or use setTimeout to ensure it's run after the first react render cycle
 * For modern code, use router hooks instead of this.
 * https://github.com/remix-run/react-router/issues/9422#issuecomment-1314642344
 *
 * Note: using `router.subscribe` in class components can cause memory leaks if
 * the returned unsubscribe function is not called in `componentWillUnmount`.
 * Prefer using router hooks (`useLocation`, `useNavigate`) in functional components.
 */
export let router: Router | null = null
export function injectRouter(newRouter: Router) {
  router = newRouter
}
