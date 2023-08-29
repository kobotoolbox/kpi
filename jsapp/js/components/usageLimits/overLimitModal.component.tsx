import React, {useEffect, useState} from 'react';
import KoboModal from '../modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import sessionStore from 'js/stores/session';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitModal.module.scss';

interface OverLimitModalProps {
  show: boolean;
  limits: string[];
  dismissed: () => void;
  interval: 'month' | 'year';
}

function OverLimitModal(props: OverLimitModalProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const accountName = sessionStore.currentAccount.username;
  const navigate = useNavigate();
  const [show, setShow] = useState(props.show);
  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const handleClose = () => {
    toggleModal();
    setShow(false);
    props.dismissed();
  };

  useEffect(() => {
    setShow(props.show);
  }, [props.show]);

  return (
    <div>
      <KoboModal isOpen={show} onRequestClose={toggleModal} size='medium'>
        <KoboModalHeader icon='warning' iconColor='red' headerColor='red'>
          {t('Usage limit exceeded')}
        </KoboModalHeader>

        <KoboModalContent>
          <div className={styles.limitModalContent}>
            <div>
              {t('Dear')} {accountName},
            </div>
            <br />
            <div>
              {t('You have exceeded the')}{' '}
              {props.limits.map((limit, i) => (
                <span key={i}>
                  {i > 0 && props.limits.length > 2 && ','}
                  {i === props.limits.length - 1 && i > 0 && ' and '}
                  {limit}
                </span>
              ))}{' '}
              {t('limit')} {props.limits.length > 1 && 's'}{' '}
              {t('included in your current plan.')}
            </div>
            <div>
              {t(
                'Please upgrade your plan to continue collecting data. Alternatively, you can delay data collection until your next usage cycle begins.'
              )}{' '}
              <a href={`#${ACCOUNT_ROUTES.USAGE}`}>{t('Review your usage')}</a>
              {'.'}
              <p>
                {t('Learn more about')}{' '}
                <a href={'https://www.kobotoolbox.org/how-it-works/'}>
                  {t('plan upgrades and add-ons')}
                </a>
                {'.'}
              </p>
            </div>
            <p>
              <strong>{t('Note:')}</strong>{' '}
              {t(
                'Users who have exceeded their usage limit will be temporarily blocked from collecting data. Repeatedly exceeding usage limits may result in account suspension.'
              )}
            </p>
          </div>
        </KoboModalContent>

        <KoboModalFooter alignment='center'>
          <Button
            type='frame'
            color='dark-blue'
            size='l'
            onClick={() => handleClose()}
            label={t('remind me later')}
            classNames={[styles.button]}
          />

          <Button
            type='full'
            color='dark-blue'
            size='l'
            onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
            label={t('upgrade now')}
            classNames={[styles.button]}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}

export default OverLimitModal;
