import React, {useEffect, useMemo, useState} from 'react';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import Checkbox from 'js/components/common/checkbox';
import styles from './confirmChangeModal.module.scss';
import type {BasePrice} from 'js/account/stripe.api';
import {ChangePlanStatus, changeSubscription} from 'js/account/stripe.api';
import {processChangePlanResponse} from 'js/account/stripe.utils';
import type {SubscriptionInfo} from 'js/account/subscriptionStore';
import {formatDate, notify} from 'js/utils';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import cx from 'classnames';
import InlineMessage from 'js/components/common/inlineMessage';

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
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const shouldShow = useMemo(
    () => !!(subscription && price),
    [price, subscription]
  );

  useEffect(() => {
    setIsLoading(false);
    setIsConfirmed(false);
  }, [shouldShow]);

  const setConfirmation = (isChecked: boolean) => {
    setIsConfirmed(isChecked);
  };

  const submitChange = () => {
    if (isLoading || !isConfirmed || !price || !subscription) {
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
                      as a credit and the cost for the new plan will be charged pro-rated
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
          <fieldset>
            <label>
              <strong>
                {t('Your card on file will be charged once you confirm.')}
              </strong>
            </label>
            <Checkbox
              checked={isConfirmed}
              onChange={setConfirmation}
              label={'Yes, I agree to this transaction'}
            />
          </fieldset>
        </section>
      </KoboModalContent>
      <KoboModalFooter>
        <Button
          type={isConfirmed ? 'full' : 'frame'}
          color={isConfirmed ? 'blue' : 'storm'}
          size='l'
          classNames={[cx({hidden: isLoading})]}
          onClick={submitChange}
          label={t('Submit')}
        />
        <Button
          type='full'
          color={isLoading ? 'storm' : 'red'}
          size='l'
          classNames={[cx({hidden: isLoading})]}
          onClick={toggleModal}
          label={t('Cancel')}
        />
      </KoboModalFooter>
    </KoboModal>
  );
};

export default ConfirmChangeModal;
