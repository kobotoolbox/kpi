import React, {useEffect, useMemo, useState} from 'react';
import cx from 'classnames';

import InlineMessage from 'js/components/common/inlineMessage';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import type {BasePrice, SubscriptionInfo} from 'js/account/stripe';
import {ChangePlanStatus} from 'js/account/stripe';
import {changeSubscription} from 'js/account/stripe.api';
import {processChangePlanResponse} from 'js/account/stripe.utils';
import {formatDate, notify} from 'js/utils';
import styles from './confirmChangeModal.module.scss';
import PlanButton from 'js/account/plans/planButton.component';

export interface ConfirmChangeProps {
  price: BasePrice | null;
  subscription: SubscriptionInfo | null;
}

const ConfirmChangeModal = ({
  price,
  subscription,
  toggleModal,
}: ConfirmChangeProps & {
  toggleModal: () => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const shouldShow = useMemo(
    () => !!(subscription && price),
    [price, subscription]
  );

  useEffect(() => {
    setIsLoading(false);
  }, [shouldShow]);

  const submitChange = () => {
    if (isLoading || !price || !subscription) {
      return;
    }
    setIsLoading(true);
    changeSubscription(price.id, subscription.id)
      .then((data) => {
        processChangePlanResponse(data).then((status) => {
          if (status !== ChangePlanStatus.success) {
            toggleModal();
          }
        });
      })
      .catch(() => {
        toggleModal();
        notify.error(
          t(
            'There was an error processing the change to your plan. Please try again later.'
          )
        );
      });
  };

  return (
    <KoboModal isOpen={shouldShow} onRequestClose={toggleModal} size='medium'>
      <KoboModalHeader>{t('Changes to your Plan')}</KoboModalHeader>
      <KoboModalContent>
        <section className={cx(styles.loading, {hidden: !isLoading})}>
          <LoadingSpinner message={t('Processing your transaction...')} />
          <InlineMessage
            message={t("Please don't navigate away from this page.")}
            type={'default'}
          />
        </section>
        <section hidden={isLoading}>
          {price?.recurring &&
            subscription?.items[0].price.recurring?.interval && (
              <>
                <p>
                  {t(`You are switching from a storage-only add-on to the Professional
                    Plan. Because this plan includes unlimited storage, your storage add-on will be canceled.`)}
                </p>
                <p>
                  {t(
                    `Your old storage add-on cost ##old_price## per ##interval##.
                      Any remainder from the add-on for the current month will be prorated
                      as a credit and the cost for the new plan will be charged prorated
                      for the remainder of this ##interval##.`
                  )
                    .replace(
                      '##old_price##',
                      subscription.items[0].price.human_readable_price.split(
                        '/'
                      )[0]
                    )
                    .replace(
                      /##interval##/g,
                      subscription.items[0].price.recurring.interval
                    )}
                </p>
                <p>
                  {t(
                    `Starting on ##billing_end_date## and until you cancel,
                      we will bill you ##new_price## per ##interval##.`
                  )
                    .replace(
                      '##billing_end_date##',
                      formatDate(subscription.current_period_end)
                    )
                    .replace(
                      '##new_price##',
                      price.human_readable_price.split('/')[0]
                    )
                    .replace('##interval##', price.recurring.interval)}
                </p>
              </>
            )}
        </section>
      </KoboModalContent>
      <KoboModalFooter>
        <PlanButton
          isDisabled={isLoading}
          onClick={submitChange}
          label={t('Submit')}
        />
        <PlanButton
          color='red'
          isDisabled={isLoading}
          onClick={toggleModal}
          label={t('Cancel')}
        />
      </KoboModalFooter>
    </KoboModal>
  );
};

export default ConfirmChangeModal;
