import React, {PropsWithChildren} from 'react';
import {OrganizationWrapper} from 'js/account/organizations/useOrganization.hook';

export const RootContextProvider = ({children}: PropsWithChildren<never>) => {
  return <OrganizationWrapper>{children}</OrganizationWrapper>;
};
