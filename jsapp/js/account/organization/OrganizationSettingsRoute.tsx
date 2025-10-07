import { useEffect, useState } from 'react'

import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'

import styles from '#/account/organization/organizationSettingsRoute.module.scss'
import subscriptionStore from '#/account/subscriptionStore'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import type { OrganizationTypeEnum } from '#/api/models/organizationTypeEnum'
import {
  getOrganizationsRetrieveQueryKey,
  useOrganizationsPartialUpdate,
} from '#/api/react-query/user-team-organization-usage'
import Button from '#/components/common/button'
import InlineMessage from '#/components/common/inlineMessage'
import KoboSelect from '#/components/common/koboSelect'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import envStore from '#/envStore'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'
import { queryClient } from '#/query/queryClient'
import { getSimpleMMOLabel } from './organization.utils'

export const ORGANIZATION_TYPES: { [P in OrganizationTypeEnum]: { name: P; label: string } } = {
  'non-profit': { name: 'non-profit', label: t('Non-profit organization') },
  government: { name: 'government', label: t('Government institution') },
  educational: { name: 'educational', label: t('Educational organization') },
  commercial: { name: 'commercial', label: t('A commercial/for-profit company') },
  none: { name: 'none', label: t('I am not associated with any organization') },
}

/**
 * Renders few fields with organization related settings, like name or website
 * (with some logic in regards to their visibility). If user has necessary role,
 * they can edit available fields.
 */
export default function OrganizationSettingsRoute() {
  const [organization, orgQuery] = useOrganizationAssumed({ staleTime: 0 /** always fetch fresh data */ })

  const [subscriptions] = useState(() => subscriptionStore)
  const [isStripeEnabled, setIsStripeEnabled] = useState(false)
  const patchOrganization = useOrganizationsPartialUpdate({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getOrganizationsRetrieveQueryKey(organization.id) })
      },
    },
  })

  // All displayed fields
  const [name, setName] = useState<string>('')
  const [website, setWebsite] = useState<string>('')
  const [orgType, setOrgType] = useState<OrganizationTypeEnum | null>(null)

  // We are invalidating the org query data when this component loads,
  // so we want to wait for a fetch fresh before setting the form data
  useEffect(() => {
    if (!orgQuery.isFetchedAfterMount) return

    setName(organization.name)
    setWebsite(organization.website)
    setOrgType(organization.organization_type)
  }, [organization, orgQuery.isFetchedAfterMount])

  useWhenStripeIsEnabled(() => {
    setIsStripeEnabled(true)
  }, [])

  const isUserAdminOrOwner =
    organization.request_user_role === MemberRoleEnum.owner || organization.request_user_role === MemberRoleEnum.admin

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    patchOrganization.mutateAsync({ id: organization.id, data: { name, website } })
  }

  function handleChangeName(newName: string) {
    setName(newName)
  }

  function handleChangeWebsite(newWebsite: string) {
    setWebsite(newWebsite)
  }

  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0], false, true)
  const mmoLabelLowercase = mmoLabel.toLowerCase()

  if (!orgQuery.isFetchedAfterMount) {
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
          disabled={!isUserAdminOrOwner || orgQuery.isFetching || patchOrganization.isPending}
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
            disabled={!isUserAdminOrOwner || orgQuery.isFetching || patchOrganization.isPending}
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
          isPending={orgQuery.isFetching || patchOrganization.isPending}
          isSubmit
        />
      </section>

      <InlineMessage type='default' message={deletionMessage} />
    </form>
  )
}
