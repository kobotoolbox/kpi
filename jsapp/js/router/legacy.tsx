/** Don't use anything here for new components */
import React, {FC} from 'react';
import {
  Params,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
  Location,
} from 'react-router-dom';
import {usePrompt} from './promptBlocker';

// https://stackoverflow.com/a/70754791/443457
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

/**
 * This is for class based components, which cannot use hooks
 * Attempts to mimic both react router 3 and 5!
 * https://v5.reactrouter.com/web/api/withRouter
 * Use hooks instead when possible
 */
export function withRouter(Component: FC) {
  function ComponentWithRouterProp(props: any) {
    let location = useLocation();
    let navigate = useNavigate();
    let [searchParams, _] = useSearchParams(); // Replaces props.location.query
    let params = useParams();
    let path = getRoutePath(location, params); // Replaces props.route.path
    return (
      <Component
        {...props}
        params={params} // Defined as props twice for compat!
        router={{location, navigate, params, searchParams, path}}
      />
    );
  }

  return ComponentWithRouterProp;
}

/** Use usePrompt directly instead for functional components */
export const Prompt = () => {
  // Hard coded message to discourage usage
  usePrompt(t('You have unsaved changes. Leave settings without saving?'));
  return <></>;
};

function getCurrentRoute() {
  return location.hash.split('#')[1] || '';
}

/**
 * Reimplementation of router v3 isActive
 */
export function routerIsActive(route: string, indexOnly = false) {
  indexOnly; // TODO router6
  return getCurrentRoute().startsWith(route);
}

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
