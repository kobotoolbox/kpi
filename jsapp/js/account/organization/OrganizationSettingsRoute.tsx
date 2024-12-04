// Libraries
import {useState, useEffect} from 'react';

// Partial components
import OrganizationSettingsField from './OrganizationSettingsField';
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';
import InlineMessage from 'jsapp/js/components/common/inlineMessage';
import Button from 'jsapp/js/components/common/button';

// Stores, hooks and utilities
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {OrganizationUserRole, useOrganizationQuery} from 'js/account/organization/organizationQuery';
import subscriptionStore from 'js/account/subscriptionStore';
import envStore from 'js/envStore';
import {getSimpleMMOLabel} from './organization.utils';

// Constants and types
import {ORGANIZATION_TYPES, type OrganizationTypeName} from 'jsapp/js/account/organization/organizationQuery';

// Styles
import styles from 'js/account/organization/organizationSettingsRoute.module.scss';

interface State {
  name: string;
  website?: string;
  type?: OrganizationTypeName;
}

/**
 * Renders few fields with organization related settings, like name or website
 * (with some logic in regards to their visibility). If user has necessary role,
 * they can edit available fields.
 */
export default function OrganizationSettingsRoute() {
  const orgQuery = useOrganizationQuery();
  const [subscriptions] = useState(() => subscriptionStore);
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

  const isUserAdminOrOwner = (
    orgQuery.data?.request_user_role &&
    [OrganizationUserRole.admin, OrganizationUserRole.owner]
      .includes(orgQuery.data?.request_user_role)
  );

  const isPendingOrgPatch = orgQuery.data && orgQuery.isPending;

  function handleSave() {
    // TODO: call the API endpoint
    // to be done while doing: https://www.notion.so/kobotoolbox/Add-react-query-mutation-hook-for-org-changes-1307e515f6548010b5d3c087b634f01a
    console.log('save');
  }

  function handleChangeName(name: string) {
    setState((prevState) => {return {...prevState, name};});
  }

  function handleChangeWebsite(website: string) {
    setState((prevState) => {return {...prevState, website};});
  }

  function isNameValueValid(currentName: string) {
    return !currentName;
  }

  function isWebsiteValueValid(currentWebsite: string) {
    return !currentWebsite;
  }

  function getTypeLabel(typeName: OrganizationTypeName) {
    return ORGANIZATION_TYPES[typeName]?.label || typeName;
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
          {t('##team/org## details').replace('##team/org##', mmoLabel)}
        </h2>
      </header>

      <section className={styles.fieldsRow}>
        <OrganizationSettingsField
          label={t('##team/org## name').replace('##team/org##', mmoLabel)}
          onChange={handleChangeName}
          value={state.name}
          validateValue={isNameValueValid}
          isDisabled={!isUserAdminOrOwner || isPendingOrgPatch}
        />

        {isStripeEnabled && state.website && (
          <OrganizationSettingsField
            label={t('##team/org## website').replace('##team/org##', mmoLabel)}
            onChange={handleChangeWebsite}
            value={state.website}
            validateValue={isWebsiteValueValid}
            isDisabled={!isUserAdminOrOwner || isPendingOrgPatch}
          />
        )}
      </section>

      <section className={styles.fieldsRow}>
        {isStripeEnabled && state.type && (
          <OrganizationSettingsField
            label={t('##team/org## type').replace('##team/org##', mmoLabel)}
            value={getTypeLabel(state.type)}
            isDisabled
          />
        )}
      </section>

      <Button
        type='primary'
        size='m'
        onClick={handleSave}
        label={t('Save')}
        isDisabled={!isUserAdminOrOwner}
        isPending={isPendingOrgPatch}
      />

      <InlineMessage
        type='default'
        message={
          t("To delete this ##team/org##, you need to cancel your current ##plan name## plan. At the end of the plan period your ##team/org##'s projects will be converted to projects owned by your personal account.")
            .replaceAll('##team/org##', mmoLabelLowercase)
            .replace('##plan name##', subscriptions.planName)
        }
      />
    </div>
  );
}
