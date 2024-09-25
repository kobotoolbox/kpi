import React, {useCallback, useEffect, useMemo, useState} from 'react';
// `cx()` is just an alias for `classNames()` - see https://github.com/JedWatson/classnames
import cx from 'classnames';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import type {
  Price,
  PriceWithProduct,
  Product,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import {ChangePlanStatus} from 'js/account/stripe.types';
import {changeSubscription} from 'js/account/stripe.api';
import {
  isAddonProduct,
  processChangePlanResponse,
} from 'js/account/stripe.utils';
import {formatDate, notify} from 'js/utils';
import styles from './confirmChangeModal.module.scss';
import BillingButton from 'js/account/plans/billingButton.component';
import {useDisplayPrice} from 'js/account/plans/useDisplayPrice.hook';

export interface ConfirmChangeProps {
  newPrice: Price | null;
  products: Product[] | null;
  quantity?: number;
  currentSubscription: SubscriptionInfo | null;
}

interface ConfirmChangeModalProps extends ConfirmChangeProps {
  onRequestClose: () => void;
  setIsBusy: (isBusy: boolean) => void;
}

/**
 * Confirmation step for downgrading a currentSubscription to a lower newPrice.
 * This modal is responsible for displaying the details of the change,
 * then making the API request.
 */
const ConfirmChangeModal = ({
  newPrice,
  products,
  currentSubscription,
  onRequestClose,
  setIsBusy,
  quantity = 1,
}: ConfirmChangeModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingChange, setPendingChange] = useState(false);
  const displayPrice = useDisplayPrice(newPrice, quantity);

  const shouldShow = useMemo(
    () => !!(currentSubscription && newPrice),
    [newPrice, currentSubscription]
  );

  const getProductForPriceId = useCallback(
    (priceId: string) =>
      products?.find((product: Product) => {
        return product.prices.some(
          (productPrice) => productPrice.id === priceId
        );
      }),
    [products]
  );

  // get a translatable description of a newPrice
  const getPriceDescription = useCallback(
    (price: Price) => {
      const product = getProductForPriceId(price.id);
      if (price && product) {
        if (isAddonProduct(product)) {
          return t('##add_on_name## add-on').replace(
            '##add_on_name##',
            product.name
          );
        }
        if (price.recurring?.interval === 'month') {
          return t('monthly ##plan_name## plan').replace(
            '##plan_name##',
            product.name
          );
        } else {
          return t('yearly ##plan_name## plan').replace(
            '##plan_name##',
            product.name
          );
        }
      }
      return '';
    },
    [products]
  );

  // get the product type to display as a translatable string
  const getPriceType = useCallback(
    (price: PriceWithProduct | null) => {
      if (!price) {
        return t('plan');
      }
      const product = getProductForPriceId(price.id);
      if (product) {
        if (isAddonProduct(product)) {
          return t('add-on');
        } else {
          return t('plan');
        }
      }
      return '';
    },
    [products]
  );

  useEffect(() => {
    if (!pendingChange) {
      setIsLoading(false);
    }
  }, [shouldShow && pendingChange]);

  const onClickCancel = () => {
    onRequestClose();
    setIsBusy(false);
  };

  const submitChange = () => {
    if (isLoading || !newPrice || !currentSubscription) {
      return;
    }
    setIsLoading(true);
    setPendingChange(true);
    changeSubscription(newPrice.id, currentSubscription.id, quantity)
      .then((data) => {
        processChangePlanResponse(data);
        setPendingChange(false);
        onClickCancel();
      })
      .catch(() => {
        notify.error(
          t(
            'There was an error processing your plan change. Your previous plan has not been changed. Please try again later.'
          ),
          {
            duration: 10000,
          }
        );
        setIsBusy(false);
        setPendingChange(false);
        onClickCancel();
      });
  };

  return (
    <KoboModal
      isOpen={shouldShow}
      onRequestClose={onRequestClose}
      size='medium'
    >
      <KoboModalHeader>{t('Changes to your Plan')}</KoboModalHeader>
      <KoboModalContent>
        <section className={cx(styles.loading, {hidden: !isLoading})}>
          <LoadingSpinner message={t('Processing your transaction…')} />
        </section>
        <section hidden={isLoading}>
          {newPrice?.recurring &&
            currentSubscription?.items[0].price.recurring?.interval && (
              <p>
                {t('You are switching to the ##new_product_type##.').replace(
                  '##new_product_type##',
                  getPriceDescription(newPrice)
                )}{' '}
                {newPrice.metadata['product_type'] === 'plan' &&
                  currentSubscription?.items[0].price.product.metadata[
                    'product_type'
                  ] === 'addon' &&
                  t(
                    'Because this plan includes unlimited storage, your storage add-on will be canceled.'
                  ) + ' '}
                {t(
                  `Your current ##product_type## will remain in effect until ##billing_end_date##.
                    Starting on ##billing_end_date## and until you cancel, we will bill you ##new_price##.`
                )
                  .replace(
                    /##product_type##/g,
                    getPriceType(currentSubscription.items[0].price)
                  )
                  .replace(
                    /##billing_end_date##/g,
                    formatDate(currentSubscription.current_period_end)
                  )
                  .replace('##new_price##', displayPrice)}
              </p>
            )}
        </section>
      </KoboModalContent>
      <KoboModalFooter>
        <BillingButton
          isDisabled={isLoading}
          onClick={submitChange}
          label={t('Submit')}
        />
        <BillingButton
          type='danger'
          isDisabled={isLoading}
          onClick={onClickCancel}
          label={t('Cancel')}
        />
      </KoboModalFooter>
    </KoboModal>
  );
};

export default ConfirmChangeModal;
