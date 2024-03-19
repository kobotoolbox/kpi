import React, {useContext, useEffect, useMemo, useState} from 'react';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import sessionStore from 'js/stores/session';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitModal.module.scss';
import Icon from 'js/components/common/icon';
import {limitBannerContainer} from './overLimitBanner.module.scss';
import cx from 'classnames';
import {OneTimeAddOn, USAGE_TYPE} from '../../stripe.types';
import {limitDisplay} from '../../stripe.utils';
import {ProductsContext} from '../../useProducts.hook';
import {UsageContext} from 'js/account/usage/useUsage.hook';
import {OneTimeAddOnsContext} from '../../useOneTimeAddonList.hook';

interface OneTimeAddOnUsageModalProps {
  type: USAGE_TYPE;
  recurringLimit: number;
  remainingLimit: number;
  oneTimeAddons: OneTimeAddOn[];
  usage: number;
}

function OneTimeAddOnUsageModal(props: OneTimeAddOnUsageModalProps) {
  const [showModal, setShowModal] = useState(false);
  const toggleModal = () => {
    setShowModal(!showModal);
  };

  const recurringUsage = useMemo(
    () =>
      props.usage < props.recurringLimit ? props.usage : props.recurringLimit,
    [props.usage, props.recurringLimit]
  );

  return (
    <li>
      <a onClick={toggleModal}>{t('View add-on details')}</a>
      <KoboModal isOpen={showModal} onRequestClose={toggleModal} size='medium'>
        <KoboModalHeader headerColor='white' onRequestCloseByX={toggleModal}>
          {t('Addon details')}
        </KoboModalHeader>
        <KoboModalContent>
          <div>
            <h2>submissions available</h2>
            <p>included with plan</p>
            <p>{limitDisplay(props.type, props.recurringLimit)}</p>
            <p>addons this month</p>
            <p>0</p>
            <p>total available</p>
            <p>{limitDisplay(props.type, props.remainingLimit)}</p>
            <h2>submissions used</h2>
            <p>included with plan</p>
            <p>{limitDisplay(props.type, recurringUsage)}</p>
            <p>addons</p>
            <p>0</p>
            <h2>Submissions balance</h2>
            <p>included with plan</p>
            <p>{limitDisplay(props.type, props.recurringLimit)}</p>
            <p>addons</p>
            <p>need remaining total</p>
            <p>total remaining</p>
            <p>{limitDisplay(props.type, props.usage, props.remainingLimit)}</p>
          </div>
        </KoboModalContent>
      </KoboModal>
    </li>
  );
}

export default OneTimeAddOnUsageModal;
