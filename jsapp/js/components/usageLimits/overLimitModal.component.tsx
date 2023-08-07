import React, {useEffect, useState} from 'react';
import KoboModal from '../modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import sessionStore from 'js/stores/session';
import {getAllExceedingLimits} from './usageCalculations';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitModal.module.scss';
import {Cookies} from 'react-cookie';
const cookies = new Cookies();

interface OverLimitModalProps {
  show: boolean;
  limits: (number: number) => void;
  dismissed: (boolean: boolean) => void;
}

function OverLimitModal(props: OverLimitModalProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const accountName = sessionStore.currentAccount.username;
  const navigate = useNavigate();
  const [show, setShow] = useState(props.show);
  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };
  const limitsLength = getAllExceedingLimits().length;

  useEffect(() => {
    props.limits(limitsLength);
  }, [limitsLength]);

  const handleClose = () => {
    toggleModal();
    setShow(false);
    props.dismissed(true);
    var dateNow = new Date();
    var expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1));
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
              {getAllExceedingLimits().map((item, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {i === limitsLength - 1 && i > 0 && 'and '}
                  {item}
                </span>
              ))}{' '}
              {t('quota')} {limitsLength > 1 && 's'}{' '}
              {t('included in your current plan.')}
            </div>
            <br />
            <div>
              {t(
                'To continue collecting data, please upgrade to a KoboToolbox plan with higher capacity, or consider waiting until the beginning of next month, when your quota will be reset again. You can learn more about monthly limits here.'
              )}
            </div>
            <br />
            <div>
              <strong>
                {t(
                  'Please note that failure to respect the monthly limits can lead to the blocking of submissions from being saved and even the suspension your account.'
                )}
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
