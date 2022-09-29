import React from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

/**
 * STOP! Don't use this. Use React Hooks instead.
 * This is for class based components which cannot use hooks.
 */
export function withRouter(Component: any) {
  function ComponentWithRouterProp(props: any) {
    let location = useLocation();
    let navigate = useNavigate();
    let params = useParams();
    return (
      <Component
        {...props}
        router={{ location, navigate, params }}
      />
    );
  }

  return ComponentWithRouterProp;
}
