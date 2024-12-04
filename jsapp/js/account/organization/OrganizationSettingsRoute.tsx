// Libraries
import {useState, useEffect} from 'react';

// Partial components
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';
import InlineMessage from 'jsapp/js/components/common/inlineMessage';
import Button from 'jsapp/js/components/common/button';
import TextBox from 'jsapp/js/components/common/textBox';
import KoboSelect from 'jsapp/js/components/common/koboSelect';

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
import NlpUsageLimitBlockModal from 'jsapp/js/components/processing/nlpUsageLimitBlockModal/nlpUsageLimitBlockModal.component';

/**
 * Renders few fields with organization related settings, like name or website
 * (with some logic in regards to their visibility). If user has necessary role,
 * they can edit available fields.
 */
export default function OrganizationSettingsRoute() {
  const orgQuery = useOrganizationQuery();
  const [subscriptions] = useState(() => subscriptionStore);
  const [name, setName] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [orgType, setOrgType] = useState<OrganizationTypeName | null>(null);
  const [isStripeEnabled, setIsStripeEnabled] = useState(false);

  useEffect(() => {
    if (orgQuery.data) {
      setName(orgQuery.data.name);
      setWebsite(orgQuery.data.website);
      setOrgType(orgQuery.data.organization_type);
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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // TODO: call the API endpoint
    // to be done while doing: https://www.notion.so/kobotoolbox/Add-react-query-mutation-hook-for-org-changes-1307e515f6548010b5d3c087b634f01a
    console.log('save', name, website);
  }

  function handleChangeName(newName: string) {
    setName(newName);
  }

  function handleChangeWebsite(newWebsite: string) {
    setWebsite(newWebsite);
  }

  const mmoLabel = getSimpleMMOLabel(
    envStore.data,
    subscriptionStore.activeSubscriptions[0],
    false,
    true
  );
  const mmoLabelLowercase = mmoLabel.toLowerCase();

  if (orgQuery.isLoading) {
    return <LoadingSpinner />;
  }

  let deletionMessage = t('To delete this ##team/org##, please contact the server administrator.')
    .replaceAll('##team/org##', mmoLabelLowercase);
  if (isStripeEnabled) {
    deletionMessage = t("To delete this ##team/org##, you need to cancel your current ##plan name## plan. At the end of the plan period your ##team/org##'s projects will be converted to projects owned by your personal account.")
    .replaceAll('##team/org##', mmoLabelLowercase)
    .replace('##plan name##', subscriptions.planName);
  }

  const currentTypeLabel = orgType === null ? '' : ORGANIZATION_TYPES[orgType]?.label;

  return (
    <form className={styles.orgSettingsRoot} onSubmit={handleSave}>
      <header className={styles.orgSettingsHeader}>
        <h2 className={styles.orgSettingsHeaderText}>
          {t('##team/org## details').replace('##team/org##', mmoLabel)}
        </h2>
      </header>

      <section className={styles.fieldsRow}>
        {/*
          On all instances, both owner and admins should be able to edit
          organization name.
        */}
        <TextBox
          className={styles.field}
          label={t('##team/org## name').replace('##team/org##', mmoLabel)}
          value={name}
          required
          onChange={handleChangeName}
          disabled={!isUserAdminOrOwner || isPendingOrgPatch}
          errors={name === ''}
        />

        {/*
          On Stripe-enabled instances, both owner and admins should be able to
          edit organization website. On non-Stripe enabled instances it is not
          visible.
        */}
        {isStripeEnabled && (
          <TextBox
            className={styles.field}
            type='url'
            label={t('##team/org## website').replace('##team/org##', mmoLabel)}
            value={website}
            required
            onChange={handleChangeWebsite}
            disabled={!isUserAdminOrOwner || isPendingOrgPatch}
            errors={website === ''}
          />
        )}
      </section>

      {/*
        On Stripe-enabled instances, both owner and admins should be able to
        view organization type. On non-Stripe enabled instances it is not
        visible.
      */}
      {isStripeEnabled && orgType && (
        <section className={styles.fieldsRow}>
          <KoboSelect
            className={styles.fieldLong}
            name='org-settings-type'
            type='outline'
            size='l'
            isDisabled // always disabled
            label={t('##team/org## type').replace('##team/org##', mmoLabel)}
            options={[{
              value: 'orgType',
              label: currentTypeLabel,
            }]}
            selectedOption='orgType'
            onChange={() => null}
          />
        </section>
      )}

      <section className={styles.fieldsRow}>
        <Button
          type='primary'
          size='m'
          label={t('Save')}
          isDisabled={!isUserAdminOrOwner}
          isPending={isPendingOrgPatch}
          isSubmit
        />
      </section>

      <InlineMessage type='default' message={deletionMessage} />
    </form>
  );
}
