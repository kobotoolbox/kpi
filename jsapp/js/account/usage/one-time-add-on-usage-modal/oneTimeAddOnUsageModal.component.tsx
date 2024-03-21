import React, {useMemo, useState} from 'react';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import styles from './oneTimeAddOnUsageModal.module.scss';
import {OneTimeAddOn, RecurringInterval, USAGE_TYPE} from '../../stripe.types';
import {useLimitDisplay} from '../../stripe.utils';
import OneTimeAddOnList from './one-time-add-on-list/oneTimeAddOnList.component';

interface OneTimeAddOnUsageModalProps {
  type: USAGE_TYPE;
  recurringLimit: number;
  remainingLimit: number;
  period: RecurringInterval;
  oneTimeAddOns: OneTimeAddOn[];
  usage: number;
}

function OneTimeAddOnUsageModal(props: OneTimeAddOnUsageModalProps) {
  const [showModal, setShowModal] = useState(false);
  const toggleModal = () => {
    setShowModal(!showModal);
  };
  const {limitDisplay} = useLimitDisplay();

  const typeTitles: {[key in USAGE_TYPE]: string} = {
    [USAGE_TYPE.STORAGE]: 'Storage GB',
    [USAGE_TYPE.SUBMISSIONS]: 'Submissions',
    [USAGE_TYPE.TRANSCRIPTION]: 'Transcription minutes',
    [USAGE_TYPE.TRANSLATION]: 'Translation characters',
  };

  const recurringUsage = useMemo(
    () =>
      props.usage < props.recurringLimit ? props.usage : props.recurringLimit,
    [props.usage, props.recurringLimit]
  );

  return (
    <>
      <li>
        <a className={styles.addonModalTrigger} onClick={toggleModal}>
          {t('View add-on details')}
        </a>
      </li>
      <KoboModal isOpen={showModal} onRequestClose={toggleModal} size='medium'>
        <KoboModalHeader headerColor='white' onRequestCloseByX={toggleModal}>
          {t('Add-on details')}
        </KoboModalHeader>
        <KoboModalContent>
          <div className={styles.addonUsageDetails}>
            <div className={styles.addonTypeHeader}>
              {t('##TYPE## available').replace(
                '##TYPE##',
                typeTitles[props.type]
              )}
            </div>
            <ul className={styles.usageBreakdown}>
              <li>
                <label>{t('Included with plan')}</label>
                <data>{limitDisplay(props.type, props.recurringLimit)}</data>
              </li>
              <li>
                <label>
                  {t('Add-ons this ##PERIOD##').replace(
                    '##PERIOD##',
                    props.period
                  )}
                </label>
                {/* TODO: Get correct figure when period calculations are available */}
                <data>0</data>
              </li>
              <li>
                <label>
                  <strong>{t('Total available')}</strong>
                </label>
                <data>
                  <strong>
                    {limitDisplay(props.type, props.remainingLimit)}
                  </strong>
                </data>
              </li>
            </ul>

            <div className={styles.addonTypeHeader}>
              {t('##TYPE## used').replace('##TYPE##', typeTitles[props.type])}
            </div>
            <ul className={styles.usageBreakdown}>
              <li>
                <label>{t('Included with plan')}</label>
                <data>{limitDisplay(props.type, recurringUsage)}</data>
              </li>
              <li>
                <label>{t('Add-ons')}</label>
                {/* TODO: Get correct figure when period calculations are available */}
                <data>0</data>
              </li>
              <li>
                <label>
                  <strong>{t('Total used')}</strong>
                </label>
                <data>
                  <strong>{limitDisplay(props.type, props.usage)}</strong>
                </data>
              </li>
            </ul>

            <div className={styles.addonTypeHeader}>
              {t('##TYPE## balance').replace(
                '##TYPE##',
                typeTitles[props.type]
              )}
            </div>
            <ul className={styles.usageBreakdown}>
              <li>
                <label>{t('Included with plan')}</label>
                <data>
                  {limitDisplay(
                    props.type,
                    recurringUsage,
                    props.recurringLimit
                  )}
                </data>
              </li>
              <li>
                <label>{t('Add-ons')}</label>
                <data>
                  {limitDisplay(
                    props.type,
                    props.recurringLimit,
                    props.remainingLimit
                  )}
                </data>
              </li>
              <li>
                <label>
                  <strong>{t('Total remaining')}</strong>
                </label>
                <data>
                  <strong>
                    {limitDisplay(
                      props.type,
                      props.usage,
                      props.remainingLimit
                    )}
                  </strong>
                </data>
              </li>
            </ul>
          </div>
          <h2 className={styles.listHeaderText}>{t('Purchased add-ons')}</h2>
          < OneTimeAddOnList oneTimeAddOns={props.oneTimeAddOns} type={props.type} />
        </KoboModalContent>
      </KoboModal>
    </>
  );
}

export default OneTimeAddOnUsageModal;
