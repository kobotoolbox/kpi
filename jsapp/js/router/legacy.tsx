/** Don't use anything here for new components */
import React from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {usePrompt} from './promptBlocker';

/**
 * This is for class based components, which cannot use hooks
 * Attempts to mimic both react router 3 and 5!
 * https://v5.reactrouter.com/web/api/withRouter
 * Use hooks instead when possible
 */
export function withRouter(Component: any) {
  function ComponentWithRouterProp(props: any) {
    let location = useLocation();
    let navigate = useNavigate();
    let [searchParams, setSearch] = useSearchParams();
    let params = useParams();
    return (
      <Component
        {...props}
        params={params} // Defined as props twice for compat!
        router={{location, navigate, params, searchParams}}
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
