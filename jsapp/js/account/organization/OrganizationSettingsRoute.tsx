// Libraries
import {useState} from 'react';
// Partial components
import OrganizationSettingsField from './OrganizationSettingsField';
// Stores, hooks and utilities
import subscriptionStore from 'js/account/subscriptionStore';
import envStore from 'js/envStore';
import {getSimpleMMOLabel} from './organization.utils';
// Constants and types
// Styles
import organizationSettingsStyles from 'js/account/organization/organizationSettingsRoute.module.scss';

interface State {
  name: string;
  website?: string;
  type?: string;
}

export default function OrganizationSettingsRoute() {
  const [state, setState] = useState<State>({name: 'Example Name', website: 'website', type: 'ngo'});
  const handleChangeName = (name: string) => setState((prevState) => {return {...prevState, name};});
  const handleChangeWebsite = (website: string) => setState((prevState) => {return {...prevState, website};});
  const validateName = (currentName: string) => !currentName;
  const validateWebsite = (currentWebsite: string) => !currentWebsite;

  const mmoLabel = getSimpleMMOLabel(
    envStore.data,
    subscriptionStore.activeSubscriptions[0],
    false,
    true
  );

  return (
    <div className={organizationSettingsStyles.securityRouteRoot}>
      <header className={organizationSettingsStyles.securityHeader}>
        <h2 className={organizationSettingsStyles.securityHeaderText}>
          {t('##team or org## details').replace('##team or org##', mmoLabel)}
        </h2>
      </header>

      <OrganizationSettingsField
        label={t('##team or org## name').replace('##team or org##', mmoLabel)}
        onChange={handleChangeName}
        value={state.name}
        validateValue={validateName}
      />

      {state.website && (
        <OrganizationSettingsField
          label={t('##team or org## website').replace('##team or org##', mmoLabel)}
          onChange={handleChangeWebsite}
          value={state.website}
          validateValue={validateWebsite}
        />
      )}

      {state.type && (
        <OrganizationSettingsField
          label={t('##team or org## type').replace('##team or org##', mmoLabel)}
          value={state.type}
        />
      )}
    </div>
  );
}
