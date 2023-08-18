import React, {useEffect, useState} from 'react';
import KoboModal from '../modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import sessionStore from 'js/stores/session';
import {getAllExceedingLimits, getPlanInterval} from './usageCalculations';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitModal.module.scss';
import {Cookies} from 'react-cookie';
const cookies = new Cookies();

interface OverLimitModalProps {
  show: boolean;
  limits: string[];
  dismissed: (boolean: boolean) => void;
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
    props.dismissed(true);
    const dateNow = new Date();
    const expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1));
    cookies.set('overLimitsCookie', {
      expires: expireDate,
    });
  };

  useEffect(() => {
    setShow(props.show);
  }, [props.show]);

  return (
    <div>
      <KoboModal isOpen={show} onRequestClose={toggleModal} size='medium'>
        <KoboModalHeader icon='alert' iconColor='red' headerColor='red'>
          {t('Warning: Account limits exceeded')}
        </KoboModalHeader>

        <KoboModalContent>
          <div className={styles.limitModalContent}>
            <div>
              {t('Dear')} {accountName},
            </div>
            <br />
            <div>
              {t('You have surpassed your')}{' '}
              {props.limits.map((item, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {i === props.limits.length - 1 && i > 0 && 'and '}
                  {item}
                </span>
              ))}{' '}
              {t('quota')} {props.limits.length > 1 && 's'}{' '}
              {t('included in your current plan.')}
            </div>
            <br />
            <div>
              {t(
                'To continue collecting data, please upgrade to a KoboToolbox plan with higher capacity, or consider waiting until the beginning of next ##PERIOD##, when your quota will be reset again. You can learn more about ##PERIOD##ly limits '
              ).replace(/##PERIOD##/g, props.interval)}
              <a href={'https://www.kobotoolbox.org/how-it-works/'}>
                {t('here')}
              </a>
              {'.'}
            </div>
            <br />
            <div>
              <strong>
                {t(
                  'Please note that failure to respect the ##PERIOD##ly limits can lead to the blocking of submissions from being saved and even the suspension your account.'
                ).replace(/##PERIOD##/g, props.interval)}
              </strong>
            </div>
          </div>
        </KoboModalContent>

        <KoboModalFooter alignment='center'>
          <Button
            type='frame'
            color='dark-blue'
            size='l'
            onClick={() => handleClose()}
            label={t('Do it later')}
            classNames={['long-button-padding']}
            aria-label={t('Do it later')}
          />

          <Button
            type='full'
            color='dark-blue'
            size='l'
            onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
            label={t('Manage subscription')}
            aria-label={t('Manage subscription')}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}

export default OverLimitModal;
