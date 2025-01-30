import React from 'react';
import {ROUTES} from 'js/router/routerConstants';

export const ChangePasswordRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './changePasswordRoute.component')
);
export const SecurityRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './security/securityRoute.component')
);
export const PlansRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './plans/plan.component')
);
export const AddOnsRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './addOns/addOns.component')
);
export const AccountSettings = React.lazy(
  () => import(/* webpackPrefetch: true */ './accountSettingsRoute')
);
export const DataStorage = React.lazy(
  () => import(/* webpackPrefetch: true */ './usage/usageTopTabs')
);
export const MembersRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './organization/MembersRoute')
);
export const OrganizationSettingsRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './organization/OrganizationSettingsRoute')
);
export const ACCOUNT_ROUTES: {readonly [key: string]: string} = {
  ACCOUNT_SETTINGS: ROUTES.ACCOUNT_ROOT + '/settings',
  USAGE: ROUTES.ACCOUNT_ROOT + '/usage',
  SECURITY: ROUTES.ACCOUNT_ROOT + '/security',
  PLAN: ROUTES.ACCOUNT_ROOT + '/plan',
  ADD_ONS: ROUTES.ACCOUNT_ROOT + '/addons',
  CHANGE_PASSWORD: ROUTES.ACCOUNT_ROOT + '/change-password',
  ORGANIZATION_SETTINGS: ROUTES.ORGANIZATION + '/settings',
  ORGANIZATION_MEMBERS: ROUTES.ORGANIZATION + '/members',
};
