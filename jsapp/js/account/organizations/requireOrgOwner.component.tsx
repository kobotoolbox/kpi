import React, {
  ReactElement,
  Suspense,
  useContext,
  useEffect,
  useState,
} from 'react';
import {RouteObject, useNavigate} from 'react-router-dom';
import {OrganizationContext} from 'js/account/organizations/useOrganization.hook';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants.';

interface Props {
  children: RouteObject[] | undefined | ReactElement;
  redirect?: boolean;
}

export const RequireOrgOwner = ({children, redirect = true}: Props) => {
  const organization = useContext(OrganizationContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (redirect && organization && !organization.is_owner) {
      navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
    }
  }, [organization, redirect]);

  return redirect && organization?.is_owner ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <LoadingSpinner />
  );
};
