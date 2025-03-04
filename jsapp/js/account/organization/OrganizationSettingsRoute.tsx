import { useEffect, useState } from 'react'

import {
  OrganizationUserRole,
  useOrganizationQuery,
  usePatchOrganization,
} from '#/account/organization/organizationQuery'
import { ORGANIZATION_TYPES, type OrganizationTypeName } from '#/account/organization/organizationQuery'
import styles from '#/account/organization/organizationSettingsRoute.module.scss'
import subscriptionStore from '#/account/subscriptionStore'
import Button from '#/components/common/button'
import InlineMessage from '#/components/common/inlineMessage'
import KoboSelect from '#/components/common/koboSelect'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import envStore from '#/envStore'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'
import { getSimpleMMOLabel } from './organization.utils'

/**
 * Renders few fields with organization related settings, like name or website
 * (with some logic in regards to their visibility). If user has necessary role,
 * they can edit available fields.
 */
export default function OrganizationSettingsRoute() {
  const orgQuery = useOrganizationQuery({ shouldForceInvalidation: true })

  const [subscriptions] = useState(() => subscriptionStore)
  const [isStripeEnabled, setIsStripeEnabled] = useState(false)
  const patchOrganization = usePatchOrganization()

  // All displayed fields
  const [name, setName] = useState<string>('')
  const [website, setWebsite] = useState<string>('')
  const [orgType, setOrgType] = useState<OrganizationTypeName | null>(null)

  // We are invalidating the org query data when this component loads,
  // so we want to wait for a fetch fresh before setting the form data
  useEffect(() => {
    if (orgQuery.data && orgQuery.isFetchedAfterMount) {
      setName(orgQuery.data.name)
      setWebsite(orgQuery.data.website)
      setOrgType(orgQuery.data.organization_type)
    }
  }, [orgQuery.data, orgQuery.isFetchedAfterMount])

  useWhenStripeIsEnabled(() => {
    setIsStripeEnabled(true)
  }, [])

  const isUserAdminOrOwner =
    orgQuery.data?.request_user_role &&
    [OrganizationUserRole.admin, OrganizationUserRole.owner].includes(orgQuery.data?.request_user_role)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    patchOrganization.mutateAsync({ name, website })
  }

  function handleChangeName(newName: string) {
    setName(newName)
  }

  function handleChangeWebsite(newWebsite: string) {
    setWebsite(newWebsite)
  }

  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0], false, true)
  const mmoLabelLowercase = mmoLabel.toLowerCase()

  if (orgQuery.isLoading || !orgQuery.isFetchedAfterMount) {
    return <LoadingSpinner />
  }

  let deletionMessage = t(
    'To delete this ##TEAM_OR_ORGANIZATION##, please contact the server administrator.',
  ).replaceAll('##TEAM_OR_ORGANIZATION##', mmoLabelLowercase)
  if (isStripeEnabled) {
    deletionMessage = t(
      "To delete this ##TEAM_OR_ORGANIZATION##, you need to cancel your current ##plan name## plan. At the end of the plan period your ##TEAM_OR_ORGANIZATION##'s projects will be converted to projects owned by your personal account.",
    )
      .replaceAll('##TEAM_OR_ORGANIZATION##', mmoLabelLowercase)
      .replace('##plan name##', subscriptions.planName)
  }

  const currentTypeLabel = orgType === null ? '' : ORGANIZATION_TYPES[orgType]?.label

  return (
    <form className={styles.orgSettingsRoot} onSubmit={handleSave}>
      <header className={styles.orgSettingsHeader}>
        <h2 className={styles.orgSettingsHeaderText}>
          {t('##TEAM_OR_ORGANIZATION## details').replace('##TEAM_OR_ORGANIZATION##', mmoLabel)}
        </h2>
      </header>

      <section className={styles.fieldsRow}>
        {/*
          On all instances, both owner and admins should be able to edit
          organization name.
        */}
        <TextBox
          className={styles.field}
          label={t('##TEAM_OR_ORGANIZATION## name').replace('##TEAM_OR_ORGANIZATION##', mmoLabel)}
          value={name}
          required
          onChange={handleChangeName}
          disabled={!isUserAdminOrOwner || orgQuery.isPending || patchOrganization.isPending}
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
            label={t('##TEAM_OR_ORGANIZATION## website').replace('##TEAM_OR_ORGANIZATION##', mmoLabel)}
            value={website}
            required
            onChange={handleChangeWebsite}
            disabled={!isUserAdminOrOwner || orgQuery.isPending || patchOrganization.isPending}
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
            label={t('##TEAM_OR_ORGANIZATION## type').replace('##TEAM_OR_ORGANIZATION##', mmoLabel)}
            options={[
              {
                value: 'orgType',
                label: currentTypeLabel,
              },
            ]}
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
          isPending={orgQuery.isPending || patchOrganization.isPending}
          isSubmit
        />
      </section>

      <InlineMessage type='default' message={deletionMessage} />
    </form>
  )
}
