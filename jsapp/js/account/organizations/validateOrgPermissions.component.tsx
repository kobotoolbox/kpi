import React, {Suspense, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import {useOrganizationQuery} from 'js/account/stripe.api';
import {OrganizationUserRole} from '../stripe.types';

interface Props {
  children: React.ReactNode;
  validRoles?: OrganizationUserRole[];
  mmoOnly?: boolean;
  redirect?: boolean;
}

/**
 * Use to handle display of pages that should only be accessible to certain user roles
 * or members of MMOs. Defaults to allowing access for all users, so you must supply
 * any restrictions.
 */
export const ValidateOrgPermissions = ({
  children,
  validRoles = undefined,
  mmoOnly = false,
  redirect = true,
}: Props) => {
  const navigate = useNavigate();
  const orgQuery = useOrganizationQuery();
  const hasValidRole = validRoles ? validRoles.includes(
    orgQuery.data?.request_user_role ?? OrganizationUserRole.member
  ) : true;
  const hasValidOrg = mmoOnly ? orgQuery.data?.is_mmo : true;

  // Redirect to Account Settings if you're not the owner
  useEffect(() => {
    if (
      redirect &&
      !orgQuery.isPending &&
      orgQuery.data &&
      !hasValidRole &&
      !hasValidOrg
    ) {
      navigate(ACCOUNT_ROUTES.ACCOUNT_SETTINGS);
    }
  }, [redirect, orgQuery.isSuccess, orgQuery.data, navigate]);

  return redirect && hasValidRole && hasValidOrg ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <LoadingSpinner />
  );
};
