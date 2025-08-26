import { type AnchorHTMLAttributes, useEffect, useState } from 'react'

import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { OrganizationUserRole, useOrganizationQuery } from '#/account/organization/organizationQuery'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import type { UsageLimitTypes } from '#/account/stripe.types'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import KoboModalFooter from '#/components/modals/koboModalFooter'
import KoboModalHeader from '#/components/modals/koboModalHeader'
import envStore from '#/envStore'
import sessionStore from '#/stores/session'
import KoboModal from '../modals/koboModal'
import { getAllLimitsText, pluralizeLimit } from './limitNotificationUtils'
import styles from './overLimitModal.module.scss'

interface OverLimitModalProps {
  show: boolean
  limits: UsageLimitTypes[]
  dismissed: () => void
  interval: 'month' | 'year'
}

function getLimitReachedMessage(
  isMmo: boolean,
  userRole: OrganizationUserRole,
  isTeamLabelActive: boolean,
  limits: string,
) {
  let firstSection: string
  let secondSection: string
  const planRoute = '/#' + ACCOUNT_ROUTES.PLAN
  const usageRoute = '/#' + ACCOUNT_ROUTES.USAGE
  if (isMmo) {
    firstSection = isTeamLabelActive
      ? t('Your team has reached the ##LIMITS_LIST## ##LIMIT_PLURALIZED## included with its current plan.')
      : t('Your organization has reached the ##LIMITS_LIST## ##LIMIT_PLURALIZED## included with its current plan.')
  } else {
    firstSection = t('You have reached the ##LIMITS_LIST## ##LIMIT_PLURALIZED## included with your current plan.')
  }
  firstSection = firstSection
    .replace('##LIMITS_LIST##', limits)
    .replace('##LIMIT_PLURALIZED##', pluralizeLimit(limits.length))

  if (userRole === OrganizationUserRole.owner) {
    secondSection = t(
      'Please [upgrade your plan](##PLAN_LINK##) as soon as possible or [contact us](##CONTACT_LINK##) to speak with our team.',
    )
      .replace('##PLAN_LINK##', planRoute)
      .replace('##CONTACT_LINK##', 'https://www.kobotoolbox.org/contact')
  } else {
    secondSection = isTeamLabelActive
      ? t('Contact your team owner about upgrading your plan.')
      : t('Contact your organization owner about upgrading your plan.')
  }
  secondSection +=
    ' ' + t('You can [review your usage in account settings](##USAGE_LINK##).').replace('##USAGE_LINK##', usageRoute)
  return firstSection + ' ' + secondSection
}

// We need to use a custom component here to open kobotoolbox.org links using target="_blank"
const LinkRendererTargetBlank = (props: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  if (props.href?.includes('kobotoolbox.org')) {
    return (
      <a href={props.href} target='_blank'>
        {props.children}
      </a>
    )
  }
  return <a href={props.href}>{props.children}</a>
}

function OverLimitModal(props: OverLimitModalProps) {
  const [isModalOpen, setIsModalOpen] = useState(true)
  const accountName = sessionStore.currentAccount.username
  const navigate = useNavigate()
  const [show, setShow] = useState(props.show)
  const toggleModal = () => {
    setIsModalOpen(!isModalOpen)
  }

  const handleClose = () => {
    toggleModal()
    setShow(false)
    props.dismissed()
  }

  useEffect(() => {
    setShow(props.show)
  }, [props.show])

  const orgQuery = useOrganizationQuery()

  if (!orgQuery.data || !envStore.isReady || !props.limits.length) {
    return null
  }

  const { is_mmo: isMmo, request_user_role: userRole } = orgQuery.data
  const shouldUseTeamLabel = !!envStore.data?.use_team_label
  const allLimitsText = getAllLimitsText(props.limits)
  const greetingMessage = t('Dear ##ACCOUNT_NAME##,').replace('##ACCOUNT_NAME##', accountName)
  const limitReachedMessage = getLimitReachedMessage(isMmo, userRole, shouldUseTeamLabel, allLimitsText)

  return (
    <div>
      <KoboModal isOpen={show} onRequestClose={toggleModal} size='medium'>
        <KoboModalHeader headerColor='white'>{t('You have reached your plan limit')}</KoboModalHeader>
        <div className={styles.content}>
          <div className={styles.messageGreeting}>{greetingMessage}</div>
          <div>
            <Markdown components={{ a: LinkRendererTargetBlank }}>{limitReachedMessage}</Markdown>
          </div>
          <div className={styles.warningBanner}>
            <Icon name={'warning'} size='m' color='mid-red' />
            <div>
              {t(
                'Users who have exceeded their submission or storage limits may be temporarily blocked from collecting data.',
              )}
            </div>
          </div>
        </div>
        <KoboModalFooter alignment='end'>
          <Button type='secondary' size='l' onClick={handleClose} label={t('remind me later')} isUpperCase />

          <Button
            type='primary'
            size='l'
            onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
            label={t('upgrade now')}
            isUpperCase
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  )
}

export default OverLimitModal
