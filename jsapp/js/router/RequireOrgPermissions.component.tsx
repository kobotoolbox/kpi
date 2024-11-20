import type React from 'react';
import {Suspense, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {
  useOrganizationQuery,
  OrganizationUserRole,
} from 'js/account/organization/organizationQuery';

interface Props {
  children: React.ReactNode;
  redirectRoute: string;
  validRoles?: OrganizationUserRole[];
  mmoOnly?: boolean;
}

/**
 * Use to handle display of pages that should only be accessible to certain user roles
 * or members of MMOs. Defaults to allowing access for all users, so you must supply
 * any restrictions.
 */
export const RequireOrgPermissions = ({
  children,
  redirectRoute,
  validRoles = undefined,
  mmoOnly = false,
}: Props) => {
  const navigate = useNavigate();
  const orgQuery = useOrganizationQuery();
  const hasValidRole = validRoles ? validRoles.includes(
    orgQuery.data?.request_user_role ?? OrganizationUserRole.member
  ) : true;
  const hasValidOrg = mmoOnly ? orgQuery.data?.is_mmo : true;

  useEffect(() => {
    if (
      orgQuery.data &&
      (!hasValidRole || !hasValidOrg)
    ) {
      navigate(redirectRoute);
    }
  }, [redirectRoute, orgQuery.data, navigate]);

  return hasValidRole && hasValidOrg ? (
    <Suspense fallback={null}>{children}</Suspense>
  ) : (
    <LoadingSpinner />
  );
};
