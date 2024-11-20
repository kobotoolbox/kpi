import classnames from 'classnames';
import styles from 'js/account/plans/plan.module.scss';
import Icon from 'js/components/common/icon';
import {PlanButton} from 'js/account/plans/planButton.component';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  SinglePricedProduct,
  Price,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import {FreeTierOverride, PlanState} from 'js/account/plans/plan.component';
import {
  getAdjustedQuantityForPrice,
  getSubscriptionsForProductId,
  isChangeScheduled,
  isDowngrade,
} from 'js/account/stripe.utils';
import KoboSelect, {KoboSelectOption} from 'js/components/common/koboSelect';
import {useDisplayPrice} from 'js/account/plans/useDisplayPrice.hook';

interface PlanContainerProps {
  product: SinglePricedProduct;
  isDisabled: boolean;
  isSubscribedProduct: (
    product: SinglePricedProduct,
    quantity: number
  ) => boolean;
  freeTierOverride: FreeTierOverride | null;
  expandComparison: boolean;
  state: PlanState;
  filteredPriceProducts: SinglePricedProduct[];
  setIsBusy: (isBusy: boolean) => void;
  hasManageableStatus: (sub: SubscriptionInfo) => boolean;
  buySubscription: (price: Price, quantity?: number) => void;
  activeSubscriptions: SubscriptionInfo[];
}

export const PlanContainer = ({
  product,
  state,
  freeTierOverride,
  expandComparison,
  filteredPriceProducts,
  isDisabled,
  setIsBusy,
  hasManageableStatus,
  isSubscribedProduct,
  buySubscription,
  activeSubscriptions,
}: PlanContainerProps) => {
  const [submissionQuantity, setSubmissionQuantity] = useState(1);
  // display price for the plan/price/quantity we're currently displaying
  const displayPrice = useDisplayPrice(product.price, submissionQuantity);
  const shouldShowManage = useCallback(
    (product: SinglePricedProduct) => {
      const subscriptions = getSubscriptionsForProductId(
        product.id,
        state.subscribedProduct
      );
      if (!subscriptions || !subscriptions.length) {
        return false;
      }

      const activeSubscription = subscriptions.find(
        (subscription: SubscriptionInfo) => hasManageableStatus(subscription)
      );
      if (!activeSubscription) {
        return false;
      }

      return isChangeScheduled(product.price, [activeSubscription]);
    },
    [hasManageableStatus, state.subscribedProduct]
  );

  const isDowngrading = useMemo(
    () => isDowngrade(activeSubscriptions, product.price, submissionQuantity),
    [activeSubscriptions, product, submissionQuantity]
  );

  // The adjusted quantity is the number we multiply the price by to get the total price
  const adjustedQuantity = useMemo(() => {
    return getAdjustedQuantityForPrice(
      submissionQuantity,
      product.price.transform_quantity
    );
  }, [product, submissionQuantity]);

  // Populate submission dropdown with the submission quantity from the customer's plan
  // Default to this price's base submission quantity, if applicable
  useEffect(() => {
    const subscribedQuantity =
      activeSubscriptions.length && activeSubscriptions?.[0].items[0].quantity;
    if (
      subscribedQuantity &&
      isSubscribedProduct(product, subscribedQuantity)
    ) {
      setSubmissionQuantity(subscribedQuantity);
    } else if (
      // if there's no active subscription, check if this price has a default quantity
      product.price.transform_quantity &&
      Boolean(
        Number(product.metadata?.submission_limit) ||
          Number(product.price.metadata?.submission_limit)
      )
    ) {
      // prioritize the submission limit from the price over the submission limit from the product
      setSubmissionQuantity(
        parseInt(product.price.metadata.submission_limit) ||
          parseInt(product.metadata.submission_limit)
      );
    }
  }, [isSubscribedProduct, activeSubscriptions, product]);

  const getFeatureMetadata = (
    product: SinglePricedProduct,
    featureItem: string
  ) => {
    if (
      product.price.unit_amount === 0 &&
      freeTierOverride &&
      freeTierOverride.hasOwnProperty(featureItem)
    ) {
      return freeTierOverride[featureItem as keyof FreeTierOverride];
    }
    return (
      product.price.metadata?.[featureItem] || product.metadata[featureItem]
    );
  };

  const renderFeaturesList = (
    items: Array<{
      icon: 'positive' | 'positive_pro' | 'negative';
      label: string;
    }>,
    title?: string
  ) => (
    <div key={title}>
      <h2 className={styles.listTitle}>{title} </h2>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <div className={styles.iconContainer}>
              {item.icon !== 'negative' ? (
                <Icon
                  name='check'
                  size='m'
                  color={item.icon === 'positive_pro' ? 'teal' : 'storm'}
                />
              ) : (
                <Icon name='close' size='m' color='mid-red' />
              )}
            </div>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );

  // Get feature items and matching icon boolean
  const getListItem = (listType: string, plan: string) => {
    const listItems: Array<{icon: boolean; item: string}> = [];
    filteredPriceProducts.map((product) =>
      Object.keys(product.metadata).map((featureItem: string) => {
        const numberItem = featureItem.lastIndexOf('_');
        const currentResult = featureItem.substring(numberItem + 1);

        const currentIcon = `feature_${listType}_check_${currentResult}`;
        if (
          featureItem.includes(`feature_${listType}_`) &&
          !featureItem.includes(`feature_${listType}_check`) &&
          product.name === plan
        ) {
          const keyName = `feature_${listType}_${currentResult}`;
          let iconBool = false;
          const itemName: string =
            product.price.metadata?.[keyName] || product.metadata[keyName];
          if (product.metadata?.[currentIcon] !== undefined) {
            iconBool = JSON.parse(product.metadata[currentIcon]);
            listItems.push({icon: iconBool, item: itemName});
          }
        }
      })
    );
    return listItems;
  };

  const returnListItem = (type: string, name: string, featureTitle: string) => {
    const items: Array<{
      icon: 'positive' | 'positive_pro' | 'negative';
      label: string;
    }> = [];
    getListItem(type, name).map((listItem) => {
      if (listItem.icon && name === 'Professional') {
        items.push({icon: 'positive_pro', label: listItem.item});
      } else if (!listItem.icon) {
        items.push({icon: 'negative', label: listItem.item});
      } else {
        items.push({icon: 'positive', label: listItem.item});
      }
    });
    return renderFeaturesList(items, featureTitle);
  };

  const submissionOptions = useMemo((): KoboSelectOption[] => {
    const options = [];
    const submissionsPerUnit =
      product.price.metadata?.submission_limit ||
      product.metadata?.submission_limit;
    const maxPlanQuantity = parseInt(
      product.price.metadata?.max_purchase_quantity || '1'
    );
    if (submissionsPerUnit) {
      for (let i = 1; i <= maxPlanQuantity; i++) {
        const submissionCount = parseInt(submissionsPerUnit) * i;
        options.push({
          label: '##submissions## submissions /month'.replace(
            '##submissions##',
            submissionCount.toLocaleString()
          ),
          value: submissionCount.toString(),
        });
      }
    }
    return options;
  }, [product]);

  const onSubmissionsChange = (value: string | null) => {
    if (value === null) {
      return;
    }
    const submissions = parseInt(value);
    if (submissions) {
      setSubmissionQuantity(submissions);
    }
  };

  const asrMinutes = useMemo(() => {
    return (
      (adjustedQuantity *
        (parseInt(product.metadata?.asr_seconds_limit || '0') ||
          parseInt(product.price.metadata?.asr_seconds_limit || '0'))) /
      60
    );
  }, [adjustedQuantity, product]);

  const mtCharacters = useMemo(() => {
    return (
      adjustedQuantity *
      (parseInt(product.metadata?.mt_characters_limit || '0') ||
        parseInt(product.price.metadata?.mt_characters_limit || '0'))
    );
  }, [adjustedQuantity, product]);

  return (
    <>
      {isSubscribedProduct(product, submissionQuantity) ? (
        <div className={styles.currentPlan}>{t('Your plan')}</div>
      ) : null}
      <div
        className={classnames({
          [styles.planContainerWithBadge]: isSubscribedProduct(
            product,
            submissionQuantity
          ),
          [styles.planContainer]: true,
        })}
      >
        <h1 className={styles.priceName}>
          {product.price?.unit_amount
            ? product.name
            : freeTierOverride?.name || product.name}
        </h1>
        <div className={styles.priceTitle}>{displayPrice}</div>
        <ul className={styles.featureContainer}>
          {product.price.transform_quantity && (
            <>
              <li className={styles.selectableFeature}>
                <Icon name='check' size='m' color='teal' />
                <KoboSelect
                  name={t('Total Submissions per Month')}
                  options={submissionOptions}
                  size={'s'}
                  type={'outline'}
                  onChange={onSubmissionsChange}
                  selectedOption={submissionQuantity.toString()}
                />
              </li>
              <li>
                <div className={styles.iconContainer}>
                  <Icon
                    name='check'
                    size='m'
                    color={product.price.unit_amount ? 'teal' : 'storm'}
                  />
                </div>
                {t(
                  '##asr_minutes## minutes of automated transcription /##plan_interval##'
                )
                  .replace('##asr_minutes##', asrMinutes.toLocaleString())
                  .replace(
                    '##plan_interval##',
                    product.price.recurring!.interval
                  )}
              </li>
              <li>
                <div className={styles.iconContainer}>
                  <Icon
                    name='check'
                    size='m'
                    color={product.price.unit_amount ? 'teal' : 'storm'}
                  />
                </div>
                {t(
                  '##mt_characters## characters of machine translation /##plan_interval##'
                )
                  .replace('##mt_characters##', mtCharacters.toLocaleString())
                  .replace(
                    '##plan_interval##',
                    product.price.recurring!.interval
                  )}
              </li>
            </>
          )}
          {Object.keys(product.metadata).map(
            (featureItem: string) =>
              featureItem.includes('feature_list_') && (
                <li key={featureItem + product.id}>
                  <div className={styles.iconContainer}>
                    <Icon
                      name='check'
                      size='m'
                      color={product.price.unit_amount ? 'teal' : 'storm'}
                    />
                  </div>
                  {getFeatureMetadata(product, featureItem)}
                </li>
              )
          )}
        </ul>
        {expandComparison && (
          <div className={styles.expandedContainer}>
            <hr />
            {state.featureTypes.map((type, index, array) => {
              const featureItem = getListItem(type, product.name);
              return (
                featureItem.length > 0 && [
                  returnListItem(
                    type,
                    product.name,
                    product.metadata[`feature_${type}_title`]
                  ),
                  index !== array.length - 1 && <hr key={`hr-${type}`} />,
                ]
              );
            })}
          </div>
        )}
        <div className={styles.planButton}>
          <PlanButton
            product={product}
            downgrading={isDowngrading}
            quantity={submissionQuantity}
            isSubscribedToPlan={isSubscribedProduct(
              product,
              submissionQuantity
            )}
            buySubscription={buySubscription}
            showManage={shouldShowManage(product)}
            isBusy={isDisabled}
            setIsBusy={setIsBusy}
          />
        </div>
      </div>
    </>
  );
};
