import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import type { RecurringInterval, UsageLimitTypes } from '#/account/stripe.types'
import ButtonNew from '#/components/common/ButtonNew'
import Icon from '#/components/common/icon'
import KoboModal from '#/components/modals/koboModal'
import KoboModalFooter from '#/components/modals/koboModalFooter'
import KoboModalHeader from '#/components/modals/koboModalHeader'

import styles from './index.module.scss'

interface NlpUsageLimitBlockModalProps {
  isModalOpen: boolean
  dismissed: () => void
  usageType: UsageLimitTypes.TRANSLATION | UsageLimitTypes.TRANSCRIPTION | UsageLimitTypes.LLM_REQUEST
  interval: RecurringInterval
}

function NlpUsageLimitBlockModal(props: NlpUsageLimitBlockModalProps) {
  const navigate = useNavigate()

  const handleClose = () => {
    props.dismissed()
  }

  return (
    <div className={styles.root}>
      <KoboModal isOpen={props.isModalOpen} onRequestClose={handleClose} size='medium'>
        <KoboModalHeader onRequestCloseByX={handleClose} headerColor='white'>
          {t('Upgrade to continue using this feature')}
        </KoboModalHeader>

        <section className={styles.modalBody}>
          <div>
            <div>
              {t('You have reached the ##LIMIT## limit for this ##PERIOD##.')
                .replace('##LIMIT##', props.usageType)
                .replace('##PERIOD##', props.interval)}{' '}
              {t('Please consider our plans or add-ons to continue using this feature.')}
            </div>
            <div className={styles.note}>
              <Icon name='information' size='s' color='blue' className={styles.noteIcon} />
              {t('You can monitor your usage')}&nbsp;
              <a href={'/#/account/usage'}>{t('here')}</a>.
            </div>
          </div>
        </section>
        <KoboModalFooter alignment='end'>
          <ButtonNew type='button' size='lg' onClick={() => navigate(ACCOUNT_ROUTES.ADD_ONS)} variant='light'>
            {t('Buy add-on')}
          </ButtonNew>

          <ButtonNew type='button' size='lg' onClick={() => navigate(ACCOUNT_ROUTES.PLAN)} variant='filled'>
            {t('Upgrade now')}
          </ButtonNew>
        </KoboModalFooter>
      </KoboModal>
    </div>
  )
}

export default NlpUsageLimitBlockModal
