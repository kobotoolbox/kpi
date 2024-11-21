import {useState} from 'react';
import organizationSettingsStyles from 'js/account/organization/organizationSettingsRoute.module.scss';
import OrganizationSettingsField from './OrganizationSettingsField';

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

  return (
    <div className={organizationSettingsStyles.securityRouteRoot}>
      <header className={organizationSettingsStyles.securityHeader}>
        <h2 className={organizationSettingsStyles.securityHeaderText}>
          {t('Team Details')}
        </h2>
      </header>
      <OrganizationSettingsField
          label={t('team name')}
          onChange={handleChangeName}
          value={state.name}
          validateValue={validateName}
      />
      {state.website && (
        <OrganizationSettingsField
            label={t('team website')}
            onChange={handleChangeWebsite}
            value={state.website}
            validateValue={validateWebsite}
        />
      )}
      {state.type && (
        <OrganizationSettingsField
            label={t('team type')}
            value={state.type}
        />
      )}
    </div>
  );
}
