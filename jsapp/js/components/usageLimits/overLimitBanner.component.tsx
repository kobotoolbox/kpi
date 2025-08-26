import cx from 'classnames'
import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { shouldUseTeamLabel } from '#/account/organization/organization.utils'
import { OrganizationUserRole, useOrganizationQuery } from '#/account/organization/organizationQuery'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import type { UsageLimitTypes } from '#/account/stripe.types'
import subscriptionStore from '#/account/subscriptionStore'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import envStore from '#/envStore'
import { getAllLimitsText as getLimitsListText, pluralizeLimit } from './limitNotificationUtils'
import styles from './overLimitBanner.module.scss'

interface OverLimitBannerProps {
  warning?: boolean
  limits: UsageLimitTypes[]
  accountPage: boolean
}

function getMessage(
  accountPage: boolean,
  isWarning: boolean,
  isMmo: boolean,
  userRole: OrganizationUserRole,
  isTeamLabelActive: boolean,
  limits: UsageLimitTypes[],
) {
  const limitsListText = getLimitsListText(limits)
  let firstSection: string
  let secondSection: string
  const planRoute = '/#' + ACCOUNT_ROUTES.PLAN
  const usageRoute = '/#' + ACCOUNT_ROUTES.USAGE

  // Message for warning banner
  if (isWarning) {
    if (isMmo) {
      firstSection = isTeamLabelActive
        ? t('Your team is approaching its ##LIMITS_LIST## ##LIMIT_PLURALIZED##.')
        : t('Your organization is approaching its ##LIMITS_LIST## ##LIMIT_PLURALIZED##.')
    } else {
      firstSection = t('You are approaching your ##LIMITS_LIST## ##LIMIT_PLURALIZED##.')
    }
    firstSection = firstSection
      .replace('##LIMITS_LIST##', limitsListText)
      .replace('##LIMIT_PLURALIZED##', pluralizeLimit(limits.length))

    if (userRole === OrganizationUserRole.owner) {
      secondSection = accountPage
        ? t('Please review your usage and [upgrade your plan](##PLAN_LINK##) if needed.')
        : t('Please [review your usage](##USAGE_LINK##) and [upgrade your plan](##PLAN_LINK##) if needed.')
      secondSection = secondSection.replace('##USAGE_LINK##', usageRoute).replace('##PLAN_LINK##', planRoute)
    } else {
      secondSection = isTeamLabelActive
        ? t('Contact your team owner about upgrading your plan if needed.')
        : t('Contact your organization owner about upgrading your plan if needed.')
    }
    return firstSection + ' ' + secondSection
  }

  // Message for exceeded limit banner
  if (isMmo) {
    firstSection = isTeamLabelActive
      ? t('Your team has reached its ##LIMITS## ##LIMIT_PLURALIZED##.')
      : t('Your organization has reached its ##LIMITS## ##LIMIT_PLURALIZED##.')
  } else {
    firstSection = t('You have reached your ##LIMITS## ##LIMIT_PLURALIZED##.')
  }
  firstSection = firstSection
    .replace('##LIMITS##', limitsListText)
    .replace('##LIMIT_PLURALIZED##', pluralizeLimit(limits.length))

  if (userRole === OrganizationUserRole.owner) {
    secondSection = t('Please upgrade your plan or purchase an add-on to increase your usage limits.')

    if (!accountPage) {
      secondSection += ' ' + t('[Review your usage](##USAGE_LINK##)').replace('##USAGE_LINK##', usageRoute)
    }
  } else {
    secondSection = isTeamLabelActive
      ? t('Contact your team owner about upgrading your plan if needed.')
      : t('Contact organization team owner about upgrading your plan if needed.')
  }
  return firstSection + ' ' + secondSection
}

const OverLimitBanner = (props: OverLimitBannerProps) => {
  const navigate = useNavigate()

  const orgQuery = useOrganizationQuery()

  if (!orgQuery.data || !envStore.isReady || !subscriptionStore.isInitialised || !props.limits.length) {
    return null
  }

  const { limits, warning } = props
  const { is_mmo: isMmo, request_user_role: userRole } = orgQuery.data
  const subscription = subscriptionStore.activeSubscriptions[0]

  // If the user is a member of an MMO, we don't show a warning for near-exceeded limits:
  if (isMmo && userRole === OrganizationUserRole.member && !!warning) {
    return null
  }

  const message = getMessage(
    props.accountPage,
    !!warning,
    isMmo,
    userRole,
    shouldUseTeamLabel(envStore.data, subscription),
    limits,
  )

  // Only owners can see the call to action links
  const shouldDisplayCTA = !isMmo || userRole === OrganizationUserRole.owner

  return (
    <div
      className={cx(styles.limitBannerContainer, {
        [styles.warningBanner]: props.warning,
        [styles.accountPage]: props.accountPage,
      })}
    >
      <Icon name={'alert'} size='m' color={props.warning ? 'amber' : 'mid-red'} />
      <div className={styles.bannerContent}>
        <Markdown>{message}</Markdown>
      </div>
      {shouldDisplayCTA && props.warning && !props.accountPage && (
        <Button
          type='text'
          endIcon='arrow-right'
          size='m'
          label={t('Monitor usage')}
          onClick={() => navigate(ACCOUNT_ROUTES.USAGE)}
          aria-label={t('monitor usage')}
          className={styles.bannerBtn}
        />
      )}
      {shouldDisplayCTA && (!props.warning || props.accountPage) && (
        <Button
          type='text'
          endIcon='arrow-right'
          size='m'
          label={t('Upgrade now')}
          onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
          aria-label={t('upgrade now')}
          className={styles.bannerBtn}
        />
      )}
    </div>
  )
}

export default OverLimitBanner
