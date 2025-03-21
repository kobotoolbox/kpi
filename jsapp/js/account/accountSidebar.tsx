import React, { useState } from 'react'

import cx from 'classnames'
import { observer } from 'mobx-react-lite'
import { NavLink } from 'react-router-dom'
import { OrganizationUserRole, useOrganizationQuery } from '#/account/organization/organizationQuery'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import subscriptionStore from '#/account/subscriptionStore'
import Icon from '#/components/common/icon'
import LoadingSpinner from '#/components/common/loadingSpinner'
import envStore from '#/envStore'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'
import type { IconName } from '#/k-icons'
import Badge from '../components/common/badge'
import styles from './accountSidebar.module.scss'
import { getSimpleMMOLabel } from './organization/organization.utils'

interface AccountNavLinkProps {
  iconName: IconName
  name: string
  to: string
  isNew?: boolean
}
function AccountNavLink(props: AccountNavLinkProps) {
  return (
    <NavLink to={props.to} className={({ isActive }) => cx(styles.navlink, isActive ? styles.activeNavlink : '')}>
      <label className={styles.navlinkLabel}>
        <Icon name={props.iconName} className={styles.navlinkIcon} size='xl' />
        <span className={props.isNew ? styles.newLinkLabelText : ''}>{props.name}</span>
        {props.isNew && <Badge color='light-blue' size='s' label='New' />}
      </label>
    </NavLink>
  )
}

// TODO: When we no longer hide the MMO sidebar behind a feature flag,
// the check for org ownership can be removed as it will be logically entailed
// by the org being single-user.
function renderSingleUserOrgSidebar(isStripeEnabled: boolean, isOwner: boolean) {
  return (
    <nav className={styles.accountSidebar}>
      <div className={styles.navGroup}>
        <AccountNavLink iconName='user' name={t('Profile')} to={ACCOUNT_ROUTES.ACCOUNT_SETTINGS} />
        <AccountNavLink iconName='lock-alt' name={t('Security')} to={ACCOUNT_ROUTES.SECURITY} />
        {isOwner && (
          <>
            <AccountNavLink iconName='reports' name={t('Usage')} to={ACCOUNT_ROUTES.USAGE} />
            {isStripeEnabled && (
              <>
                <AccountNavLink iconName='editor' name={t('Plans')} to={ACCOUNT_ROUTES.PLAN} />
                <AccountNavLink iconName='plus' name={t('Add-ons')} to={ACCOUNT_ROUTES.ADD_ONS} isNew />
              </>
            )}
          </>
        )}
      </div>
    </nav>
  )
}

function renderMmoSidebar(userRole: OrganizationUserRole, isStripeEnabled: boolean, mmoLabel: string) {
  const showBillingRoutes = userRole === OrganizationUserRole.owner && isStripeEnabled
  const hasAdminPrivileges = [OrganizationUserRole.admin, OrganizationUserRole.owner].includes(userRole)

  return (
    <nav className={styles.accountSidebar}>
      <div className={styles.subhead}>{t('ACCOUNT')}</div>
      <div className={styles.navGroup}>
        <AccountNavLink iconName='user' name={t('Profile')} to={ACCOUNT_ROUTES.ACCOUNT_SETTINGS} />
        <AccountNavLink iconName='lock-alt' name={t('Security')} to={ACCOUNT_ROUTES.SECURITY} />
      </div>
      <div className={styles.navGroup}>
        <div className={styles.subhead}>{mmoLabel.toUpperCase()}</div>
        <AccountNavLink iconName='users' name={t('Members')} to={ACCOUNT_ROUTES.ORGANIZATION_MEMBERS} />
        {hasAdminPrivileges && <AccountNavLink iconName='reports' name={t('Usage')} to={ACCOUNT_ROUTES.USAGE} />}
        {showBillingRoutes && (
          <>
            <AccountNavLink iconName='editor' name={t('Plans')} to={ACCOUNT_ROUTES.PLAN} />
            <AccountNavLink iconName='plus' name={t('Add-ons')} to={ACCOUNT_ROUTES.ADD_ONS} isNew />
          </>
        )}
        {hasAdminPrivileges && (
          <AccountNavLink iconName='settings' name={t('Settings')} to={ACCOUNT_ROUTES.ORGANIZATION_SETTINGS} />
        )}
      </div>
    </nav>
  )
}

function AccountSidebar() {
  const [isStripeEnabled, setIsStripeEnabled] = useState(false)
  const orgQuery = useOrganizationQuery()

  useWhenStripeIsEnabled(() => {
    if (!subscriptionStore.isInitialised) {
      subscriptionStore.fetchSubscriptionInfo()
    }
    setIsStripeEnabled(true)
  }, [subscriptionStore.isInitialised])

  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0])

  if (!orgQuery.data) {
    return <LoadingSpinner />
  }

  if (orgQuery.data.is_mmo) {
    return renderMmoSidebar(orgQuery.data?.request_user_role, isStripeEnabled, mmoLabel)
  }

  return renderSingleUserOrgSidebar(isStripeEnabled, orgQuery.data.is_owner)
}

export default observer(AccountSidebar)
