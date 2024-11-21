import type React from 'react';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {useOrganizationQuery} from 'js/account/organization/organizationQuery';

interface Props {
  children: React.ReactNode;
}

/**
 * Organization object is used globally.
 * Handle error once at the top for convenience to avoid error handling every time.
 */
export const RequireOrg = ({children}: Props) => {
  const orgQuery = useOrganizationQuery();

  if (orgQuery.isPending) {return <LoadingSpinner />;}
  if (orgQuery.error) {return <LoadingSpinner />;} // TODO: Nicier error page.

  return children;
};
