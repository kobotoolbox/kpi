import React, {Suspense, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useOrganizationQuery} from 'js/query/queries/organizations.query';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';

interface Props {
  children: React.ReactNode;
  redirect?: boolean;
}

export const RequireOrgOwner = ({children, redirect = true}: Props) => {
  const navigate = useNavigate();
  const orgQuery = useOrganizationQuery();

  // Redirect to Account Settings if you're not the owner
  useEffect(() => {
    if (
      redirect &&
      orgQuery.isSuccess &&
      !orgQuery.data.is_owner
    ) {
      navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
    }
  }, [redirect, orgQuery.isSuccess, orgQuery.data, navigate]);

  if (orgQuery.isError) {
    // TODO: non-silent error, here or elsewhere?
    return null;
  }
  if (orgQuery.isPending) {
    return <LoadingSpinner />;
  }

  if (orgQuery.isSuccess && orgQuery.data.is_owner) {
    <Suspense fallback={null}>{children}</Suspense>;
  }

  // Show a loading spinner if waiting for redirect effect
  return <LoadingSpinner />;
};
