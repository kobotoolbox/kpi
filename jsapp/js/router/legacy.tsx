/** Don't use anything here for new components */
import type {FC} from 'react';
import React from 'react';
import type {Params, Location, NavigateFunction} from 'react-router-dom';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import type {Router} from '@remix-run/router';

// https://stackoverflow.com/a/70754791/443457
/**
 * @deprecated Use `getCurrentPath` from `routerUtils.ts`.
 */
const getRoutePath = (location: Location, params: Params): string => {
  const {pathname} = location;

  if (!Object.keys(params).length) {
    return pathname; // we don't need to replace anything
  }

  let path = pathname;
  Object.entries(params).forEach(([paramName, paramValue]) => {
    if (paramValue) {
      path = path.replace(paramValue, `:${paramName}`);
    }
  });
  return path;
};

interface RouterProp {
  location: Location;
  navigate: NavigateFunction;
  params: Readonly<Params<string>>;
  searchParams: URLSearchParams; // Replaces props.location.query
  path: string; // Replaces props.route.path
}

export interface WithRouterProps {
  router: RouterProp;
  params: Readonly<Params<string>>; // Defined as props twice for compat!
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
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, _] = useSearchParams();
    const params = useParams();
    const path = getRoutePath(location, params);
    const router: RouterProp = {location, navigate, params, searchParams, path};
    return <Component {...props} params={params} router={router} />;
  }

  return ComponentWithRouterProp;
}

/**
 * @deprecated Use some of the functions from `routerUtils.ts`.
 */
function getCurrentRoute() {
  return router!.state.location.pathname;
}

/**
 * Reimplementation of router v3 isActive
 *
 * @deprecated Use some of the functions from `routerUtils.ts`.
 */
export function routerIsActive(route: string) {
  return getCurrentRoute().startsWith(route);
}

/**
 * @deprecated Use `getRouteAssetUid` from `routerUtils.ts`.
 */
export function routerGetAssetId() {
  const current = getCurrentRoute();
  if (current) {
    const routeParts = current.split('/');
    if (routeParts[1] === 'forms') {
      return routeParts[2];
    } else if (routeParts[1] === 'library') {
      return routeParts[3];
    }
  }
  return null;
}

/**
 * Necessary to avoid circular dependency
 * Because router may be null, non-component uses may need to check
 * null status or use setTimeout to ensure it's run after the first react render cycle
 * For modern code, use router hooks instead of this.
 * https://github.com/remix-run/react-router/issues/9422#issuecomment-1314642344
 *
 * Note: using `router.subscribe` will cause memory leaks and could produce bugs
 * when using hot reload on development environment. This is because `subscribe`
 * method doesn't have a cancel function.
 */
export let router: Router | null = null;
export function injectRouter(newRouter: Router) {
  router = newRouter;
}
