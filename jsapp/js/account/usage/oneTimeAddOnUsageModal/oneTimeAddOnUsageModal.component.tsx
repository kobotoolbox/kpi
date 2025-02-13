import React, {useState} from 'react';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import styles from './oneTimeAddOnUsageModal.module.scss';
import {OneTimeAddOn, RecurringInterval, USAGE_TYPE} from '../../stripe.types';
import {useLimitDisplay} from '../../stripe.utils';
import OneTimeAddOnList from './oneTimeAddOnList/oneTimeAddOnList.component';

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

  const periodAdjectiveDisplay: {[key in RecurringInterval]: string} = {
    year: 'yearly',
    month: 'monthly',
  };

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
        <section className={styles.addonModalContent}>
          <div className={styles.addonUsageDetails}>
            <div className={styles.addonTypeHeader}>
              {t('##TYPE##').replace('##TYPE##', typeTitles[props.type])}
            </div>
            <ul className={styles.usageBreakdown}>
              <li>
                <label>
                  {t('Included with ##PERIOD## plan').replace(
                    '##PERIOD##',
                    periodAdjectiveDisplay[props.period]
                  )}
                </label>
                <data>{limitDisplay(props.type, props.recurringLimit)}</data>
              </li>
              <li>
                <label>{t('From add-ons')}</label>
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
                  {t('Used this ##PERIOD##').replace(
                    '##PERIOD##',
                    props.period
                  )}
                </label>
                <data>{limitDisplay(props.type, props.usage)}</data>
              </li>
              <li className={styles.totalAvailable}>
                <label>
                  <strong>{t('Total available')}</strong>
                </label>
                <data>
                  <strong>
                    {limitDisplay(props.type, props.usage, props.remainingLimit)}
                  </strong>
                </data>
              </li>
            </ul>
          </div>
          <h2 className={styles.listHeaderText}>{t('Purchased add-ons')}</h2>
          <OneTimeAddOnList
            oneTimeAddOns={props.oneTimeAddOns}
            type={props.type}
          />
        </section>
      </KoboModal>
    </>
  );
}

export default OneTimeAddOnUsageModal;
