import React, {Suspense, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useOrganizationQuery} from 'js/account/organizations/useOrganization.hook';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import {ReactQueryStatuses} from 'jsapp/js/constants';

interface Props {
  children: React.ReactNode;
  redirect?: boolean;
}

export const RequireOrgOwner = ({children, redirect = true}: Props) => {
  const {
    data: organizationData,
    status: organizationStatus,
  } = useOrganizationQuery();
  const navigate = useNavigate();

  useEffect(() => {
    if (
      redirect &&
      !(organizationStatus === ReactQueryStatuses.pending) &&
      organizationData &&
      !organizationData.is_owner
    ) {
      navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
    }
  }, [organizationData, organizationStatus, redirect]);

  return redirect && organizationData?.is_owner ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <LoadingSpinner />
  );
};
