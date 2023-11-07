import React, {useCallback, useEffect, useMemo, useState} from 'react';
import cx from 'classnames';

import LoadingSpinner from 'js/components/common/loadingSpinner';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import type {
  BasePrice,
  Product,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import {ChangePlanStatus} from 'js/account/stripe.types';
import {changeSubscription} from 'js/account/stripe.api';
import {
  isAddonProduct,
  processChangePlanResponse,
} from 'js/account/stripe.utils';
import {formatDate} from 'js/utils';
import styles from './confirmChangeModal.module.scss';
import BillingButton from 'js/account/plans/billingButton.component';

export interface ConfirmChangeProps {
  price: BasePrice | null;
  products: Product[] | null;
  subscription: SubscriptionInfo | null;
}

const ConfirmChangeModal = ({
  price,
  products,
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

  const getProductForPrice = useCallback(
    (price) =>
      products?.find((product: Product) => {
        return product.prices.some(
          (productPrice) => productPrice.id === price.id
        );
      }),
    [products]
  );

  // get a translatable description of a price
  const getPriceDescription = useCallback(
    (price: BasePrice) => {
      const product = getProductForPrice(price);
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
    (price: BasePrice) => {
      const product = getProductForPrice(price);
      if (price && product) {
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
      .catch(toggleModal);
  };

  return (
    <KoboModal isOpen={shouldShow} onRequestClose={toggleModal} size='medium'>
      <KoboModalHeader>{t('Changes to your Plan')}</KoboModalHeader>
      <KoboModalContent>
        <section className={cx(styles.loading, {hidden: !isLoading})}>
          <LoadingSpinner message={t('Processing your transaction...')} />
        </section>
        <section hidden={isLoading}>
          {price?.recurring &&
            subscription?.items[0].price.recurring?.interval && (
              <>
                <p>
                  {t('You are switching to the ##new_product_type##.').replace(
                    /##new_product_type##/g,
                    getPriceDescription(price)
                  )}{' '}
                  {price.metadata['product_type'] === 'plan' &&
                    subscription?.items[0].price.product.metadata[
                      'product_type'
                    ] === 'addon' &&
                    t(
                      'Because this plan includes unlimited storage, your storage add-on will be canceled.'
                    ) + ' '}
                  {t(
                    `Your current ##product_type## will remain in effect until ##billing_end_date##.
                    Starting on ##billing_end_date## and until you cancel, we will bill you ##new_price## per ##interval##.`
                  )
                    .replace(
                      /##product_type##/g,
                      getPriceType(subscription.items[0].price)
                    )
                    .replace(
                      /##billing_end_date##/g,
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
        <BillingButton
          isDisabled={isLoading}
          onClick={submitChange}
          label={t('Submit')}
        />
        <BillingButton
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
