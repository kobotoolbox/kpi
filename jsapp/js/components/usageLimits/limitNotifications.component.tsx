import LimitBanner from 'js/components/usageLimits/overLimitBanner.component';
import envStore from 'js/envStore';
import LimitModal from 'js/components/usageLimits/overLimitModal.component';
import React, {useEffect, useState} from 'react';
import {Cookies} from 'react-cookie';
import {
  getAllExceedingLimits,
  getPlanInterval,
} from 'js/components/usageLimits/usageCalculations';

const cookies = new Cookies();

interface LimitNotificationsProps {
  useModal?: boolean;
}

const LimitNotifications = ({useModal = false}: LimitNotificationsProps) => {
  const [showModal, setShowModal] = useState(useModal);
  const [dismissed, setDismissed] = useState(useModal);

  const limits = getAllExceedingLimits();
  const interval = getPlanInterval();

  useEffect(() => {
    const limitsCookie = cookies.get('kpiOverLimitsCookie');
    if (
      limitsCookie === undefined &&
      (limits.exceedList.includes('storage') ||
        limits.exceedList.includes('submissions'))
    ) {
      setShowModal(true);
    }
    if (limitsCookie && limits.exceedList.length) {
      setDismissed(true);
    }
  }, [limits]);

  const modalDismissed = () => {
    setDismissed(true);
    const dateNow = new Date();
    const expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1));
    cookies.set('kpiOverLimitsCookie', {
      expires: expireDate,
    });
  };

  return (
    <>
      {dismissed && (
        <LimitBanner interval={interval} limits={limits.exceedList} />
      )}
      <LimitBanner warning interval={interval} limits={limits.warningList} />
      {envStore.data.stripe_public_key !== null && (
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
