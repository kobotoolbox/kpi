import cx from 'classnames';
import React, {useEffect, useState} from 'react';
import KoboModal from '../../modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import Icon from 'js/components/common/icon';
import {useNavigate} from 'react-router-dom';
import styles from './nlpUsageLimitBlockModal.module.scss';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';

interface NlpUsageLimitBlockModalProps {
  isModalOpen: boolean;
  dismissed: () => void;
  limit: string;
  interval: 'month' | 'year';
}

function NlpUsageLimitBlockModal(props: NlpUsageLimitBlockModalProps) {
  const navigate = useNavigate();

  const handleClose = () => {
    props.dismissed();
  };

  return (
    <div>
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
                .replace('##LIMIT##', props.limit)
                .replace('##PERIOD##', props.interval)}{' '}
              {t(
                'Please consider our plans or add-ons to continue using this feature'
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
            type='frame'
            color='dark-blue'
            size='l'
            onClick={handleClose}
            label={t('Go back')}
            className={cx([styles.button, styles.frame])}
          />

          <Button
            type='full'
            color='blue'
            size='l'
            onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
            label={t('Upgrade now')}
            className={cx([styles.button, styles.full])}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}

export default NlpUsageLimitBlockModal;
