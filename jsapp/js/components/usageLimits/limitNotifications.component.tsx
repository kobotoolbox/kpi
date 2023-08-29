import LimitBanner from 'js/components/usageLimits/overLimitBanner.component';
import envStore from 'js/envStore';
import LimitModal from 'js/components/usageLimits/overLimitModal.component';
import React, {useEffect, useState} from 'react';
import {Cookies} from 'react-cookie';
import {
  getAllExceedingLimits,
  getPlanInterval,
} from 'js/components/usageLimits/usageCalculations';
import {when} from 'mobx';
import useWhen from 'js/hooks/useWhen.hook';

const cookies = new Cookies();

interface LimitNotificationsProps {
  useModal?: boolean;
}

const LimitNotifications = ({useModal = false}: LimitNotificationsProps) => {
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(!useModal);
  const [stripeEnabled, setStripeEnabled] = useState(false);

  const limits = getAllExceedingLimits();
  const interval = getPlanInterval();

  useWhen(
    () => envStore.isReady && envStore.data.stripe_public_key !== null,
    () => {
      setStripeEnabled(true);
      // only check cookies if we're displaying a modal
      if (!useModal) {
        return;
      }
      const limitsCookie = cookies.get('kpiOverLimitsCookie');
      if (
        limitsCookie === undefined &&
        (limits.exceedList.includes('storage') ||
          limits.exceedList.includes('submission'))
      ) {
        setShowModal(true);
      }
      if (limitsCookie) {
        setDismissed(true);
      }
    },
    [limits]
  );

  const modalDismissed = () => {
    setDismissed(true);
    const dateNow = new Date();
    const expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1));
    cookies.set('kpiOverLimitsCookie', {
      expires: expireDate,
    });
  };

  if (!stripeEnabled) {
    return null;
  }

  return (
    <>
      {dismissed && (
        <LimitBanner interval={interval} limits={limits.exceedList} />
      )}
      {!limits.exceedList.length && (
        <LimitBanner warning interval={interval} limits={limits.warningList} />
      )}
      {useModal && (
        <LimitModal
          show={showModal}
          limits={limits.exceedList}
          interval={interval}
          dismissed={modalDismissed}
        />
      )}
    </>
  );
};

export default LimitNotifications;
