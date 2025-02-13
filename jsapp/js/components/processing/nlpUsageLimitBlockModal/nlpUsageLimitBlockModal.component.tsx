import cx from 'classnames';
import React from 'react';
import KoboModal from '../../modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import Icon from 'js/components/common/icon';
import {useNavigate} from 'react-router-dom';
import styles from './nlpUsageLimitBlockModal.module.scss';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import { RecurringInterval, UsageLimitTypes } from 'jsapp/js/account/stripe.types';

interface NlpUsageLimitBlockModalProps {
  isModalOpen: boolean;
  dismissed: () => void;
  usageType: UsageLimitTypes.TRANSLATION | UsageLimitTypes.TRANSCRIPTION;
  interval: RecurringInterval;
}

function NlpUsageLimitBlockModal(props: NlpUsageLimitBlockModalProps) {
  const navigate = useNavigate();

  const handleClose = () => {
    props.dismissed();
  };

  return (
    <div className={styles.root}>
      <KoboModal
        isOpen={props.isModalOpen}
        onRequestClose={handleClose}
        size='medium'
      >
        <KoboModalHeader onRequestCloseByX={handleClose} headerColor='white'>
          {t('Upgrade to continue using this feature')}
        </KoboModalHeader>

        <section className={styles.modalBody}>
          <div>
            <div>
              {t('You have reached the ##LIMIT## limit for this ##PERIOD##.')
                .replace('##LIMIT##', props.usageType)
                .replace('##PERIOD##', props.interval)}{' '}
              {t(
                'Please consider our plans or add-ons to continue using this feature.'
              )}
            </div>
            <div className={styles.note}>
              <Icon
                name='information'
                size='s'
                color='blue'
                className={styles.noteIcon}
              />
              {t('You can monitor your usage')}&nbsp;
              <a href={'/#/account/usage'}>{t('here')}</a>.
            </div>
          </div>
        </section>

        <KoboModalFooter alignment='end'>
          <Button
            type='secondary'
            size='l'
            onClick={handleClose}
            label={t('Go back')}
          />

          <Button
            type='primary'
            size='l'
            onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
            label={t('Upgrade now')}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}

export default NlpUsageLimitBlockModal;
