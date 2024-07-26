import React, {Suspense, useContext, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {OrganizationContext} from 'js/account/organizations/useOrganization.hook';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';

interface Props {
  children: React.ReactNode;
  redirect?: boolean;
}

export const RequireOrgOwner = ({children, redirect = true}: Props) => {
  const [organization, _, orgStatus] = useContext(OrganizationContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (
      redirect &&
      !orgStatus.pending &&
      organization &&
      !organization.is_owner
    ) {
      navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
    }
  }, [organization, orgStatus.pending, redirect]);

  return redirect && organization?.is_owner ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <LoadingSpinner />
  );
};
