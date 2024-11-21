// Libraries
import {useState, useEffect} from 'react';

// Partial components
import OrganizationSettingsField from './OrganizationSettingsField';
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';
import InlineMessage from 'jsapp/js/components/common/inlineMessage';

// Stores, hooks and utilities
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {useOrganizationQuery} from 'js/account/organization/organizationQuery';
import subscriptionStore from 'js/account/subscriptionStore';
import envStore from 'js/envStore';
import {getSimpleMMOLabel} from './organization.utils';

// Constants and types
import {ORGANIZATION_TYPE_SELECT_OPTIONS} from 'js/account/accountFieldsEditor.component';

// Styles
import styles from 'js/account/organization/organizationSettingsRoute.module.scss';

interface State {
  name: string;
  website?: string;
  type?: string;
}

export default function OrganizationSettingsRoute() {
  const orgQuery = useOrganizationQuery();
  const [state, setState] = useState<State>({name: ''});
  const [isStripeEnabled, setIsStripeEnabled] = useState(false);

  useEffect(() => {
    if (orgQuery.data) {
      setState({name: orgQuery.data.name});
    }
  }, [orgQuery.data]);

  useWhenStripeIsEnabled(() => {
    setIsStripeEnabled(true);
  }, []);

  function handleChangeName(name: string) {
    setState((prevState) => {return {...prevState, name};});
    // TODO: call the API endpoint and mark things as `isPending`
  }
  function handleChangeWebsite(website: string) {
    setState((prevState) => {return {...prevState, website};});
    // TODO: call the API endpoint and mark things as `isPending`
  }
  function isNameValueValid(currentName: string) {
    return !currentName;
  }
  function isWebsiteValueValid(currentWebsite: string) {
    return !currentWebsite;
  }

  function getTypeLabel(typeName: string) {
    // TODO: see if this would be an actual source of the organization type label
    const foundLabel = ORGANIZATION_TYPE_SELECT_OPTIONS.find((item) => item.value === typeName)?.label;
    return foundLabel || typeName;
  }

  const mmoLabel = getSimpleMMOLabel(
    envStore.data,
    subscriptionStore.activeSubscriptions[0],
    false,
    true
  );
  const mmoLabelLowercase = mmoLabel.toLowerCase();

  if (!orgQuery.data) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.orgSettingsRoot}>
      <header className={styles.orgSettingsHeader}>
        <h2 className={styles.orgSettingsHeaderText}>
          {t('##team or org## details').replace('##team or org##', mmoLabel)}
        </h2>
      </header>

      <section className={styles.fieldsRow}>
        <OrganizationSettingsField
          label={t('##team or org## name').replace('##team or org##', mmoLabel)}
          onChange={handleChangeName}
          value={state.name}
          validateValue={isNameValueValid}
        />

        {isStripeEnabled && state.website && (
          <OrganizationSettingsField
            label={t('##team or org## website').replace('##team or org##', mmoLabel)}
            onChange={handleChangeWebsite}
            value={state.website}
            validateValue={isWebsiteValueValid}
          />
        )}
      </section>

      <section className={styles.fieldsRow}>
        {isStripeEnabled && state.type && (
          <OrganizationSettingsField
            label={t('##team or org## type').replace('##team or org##', mmoLabel)}
            value={getTypeLabel(state.type)}
          />
        )}
      </section>

      <InlineMessage
        type='default'
        // TODO: replace `##plan name##` with proper thing
        message={
          t("To delete this ##team or org##, you need to cancel your current ##plan name##. At the end of the plan period your ##team or org##'s projects will be converted to projects owned by your personal account.")
            .replaceAll('##team or org##', mmoLabelLowercase)
        }
      />
    </div>
  );
}
