import React, {Suspense, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import {useOrganizationQuery} from 'js/account/stripe.api';

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
      !orgQuery.isPending &&
      orgQuery.data &&
      !orgQuery.data.is_owner
    ) {
      navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
    }
  }, [redirect, orgQuery.isSuccess, orgQuery.data, navigate]);

  return redirect && orgQuery.data?.is_owner ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <LoadingSpinner />
  );
};
