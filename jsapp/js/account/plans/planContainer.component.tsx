import classnames from 'classnames';
import styles from 'js/account/plans/plan.module.scss';
import Icon from 'js/components/common/icon';
import {PlanButton} from 'js/account/plans/planButton.component';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {BasePrice, Price, SubscriptionInfo} from 'js/account/stripe.types';
import {FreeTierOverride, PlanState} from 'js/account/plans/plan.component';
import {
  getAdjustedQuantityForPrice,
  getSubscriptionsForProductId,
  isChangeScheduled,
} from 'js/account/stripe.utils';
import KoboSelect, {KoboSelectOption} from 'js/components/common/koboSelect';
import {useDisplayPrice} from 'js/account/plans/useDisplayPrice.hook';

interface PlanContainerProps {
  price: Price;
  isDisabled: boolean;
  isSubscribedProduct: (product: Price, quantity: number) => boolean;
  freeTierOverride: FreeTierOverride | null;
  expandComparison: boolean;
  state: PlanState;
  filterPrices: Price[];
  setIsBusy: (isBusy: boolean) => void;
  hasManageableStatus: (sub: SubscriptionInfo) => boolean;
  buySubscription: (price: BasePrice, quantity?: number) => void;
  activeSubscriptions: SubscriptionInfo[];
}

export const PlanContainer = ({
  price,
  state,
  freeTierOverride,
  expandComparison,
  filterPrices,
  isDisabled,
  setIsBusy,
  hasManageableStatus,
  isSubscribedProduct,
  buySubscription,
  activeSubscriptions,
}: PlanContainerProps) => {
  const [submissionQuantity, setSubmissionQuantity] = useState(1);
  const displayPrice = useDisplayPrice(price.prices, submissionQuantity);
  const shouldShowManage = useCallback(
    (product: Price) => {
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

      return isChangeScheduled(product.prices, [activeSubscription]);
    },
    [hasManageableStatus, state.subscribedProduct]
  );

  // The adjusted quantity is the number we multiply the price by to get the total price
  const adjustedQuantity = useMemo(() => {
    return getAdjustedQuantityForPrice(
      submissionQuantity,
      price.prices.transform_quantity
    );
  }, [price, submissionQuantity]);

  // Populate submission dropdown with the submission quantity from the customer's plan
  // Default to this price's base submission quantity, if applicable
  useEffect(() => {
    const subscribedQuantity =
      activeSubscriptions.length && activeSubscriptions?.[0].items[0].quantity;
    if (subscribedQuantity && isSubscribedProduct(price, subscribedQuantity)) {
      setSubmissionQuantity(subscribedQuantity);
    } else if (
      // if there's no active subscription, check if this price has a default quantity
      price.prices.transform_quantity &&
      Boolean(
        Number(price.metadata?.submission_limit) ||
          Number(price.prices.metadata?.submission_limit)
      )
    ) {
      // prioritize the submission limit from the price over the submission limit from the product
      setSubmissionQuantity(
        parseInt(price.prices.metadata.submission_limit) ||
          parseInt(price.metadata.submission_limit)
      );
    }
  }, [isSubscribedProduct, activeSubscriptions, price]);

  const getFeatureMetadata = (price: Price, featureItem: string) => {
    if (
      price.prices.unit_amount === 0 &&
      freeTierOverride &&
      freeTierOverride.hasOwnProperty(featureItem)
    ) {
      return freeTierOverride[featureItem as keyof FreeTierOverride];
    }
    return price.prices.metadata?.[featureItem] || price.metadata[featureItem];
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
                <Icon name='close' size='m' color='red' />
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
    filterPrices.map((price) =>
      Object.keys(price.metadata).map((featureItem: string) => {
        const numberItem = featureItem.lastIndexOf('_');
        const currentResult = featureItem.substring(numberItem + 1);

        const currentIcon = `feature_${listType}_check_${currentResult}`;
        if (
          featureItem.includes(`feature_${listType}_`) &&
          !featureItem.includes(`feature_${listType}_check`) &&
          price.name === plan
        ) {
          const keyName = `feature_${listType}_${currentResult}`;
          let iconBool = false;
          const itemName: string =
            price.prices.metadata?.[keyName] || price.metadata[keyName];
          if (price.metadata?.[currentIcon] !== undefined) {
            iconBool = JSON.parse(price.metadata[currentIcon]);
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
      price.prices.metadata?.submission_limit ||
      price.metadata?.submission_limit;
    const maxPlanQuantity = parseInt(
      price.prices.metadata?.max_purchase_quantity || '1'
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
  }, [price]);

  const onSubmissionsChange = (value: string | null) => {
    if (value === null) {
      return;
    }
    const submissions = parseInt(value);
    if (submissions) {
      setSubmissionQuantity(submissions);
    }
  };

  return (
    <>
      {isSubscribedProduct(price, submissionQuantity) ? (
        <div className={styles.currentPlan}>{t('Your plan')}</div>
      ) : isSubscribedProduct(price, submissionQuantity) ? (
        <div className={styles.currentPlan}>{t('Your plan')}</div>
      ) : null}
      <div
        className={classnames({
          [styles.planContainerWithBadge]: isSubscribedProduct(
            price,
            submissionQuantity
          ),
          [styles.planContainer]: true,
        })}
      >
        <h1 className={styles.priceName}>
          {price.prices?.unit_amount
            ? price.name
            : freeTierOverride?.name || price.name}
        </h1>
        <div className={styles.priceTitle}>{displayPrice}</div>
        <ul className={styles.featureContainer}>
          {price.prices.transform_quantity && (
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
                    color={price.prices.unit_amount ? 'teal' : 'storm'}
                  />
                </div>
                {t('##asr_minutes## minutes of automated transcription /month')
                  .replace(
                    '##asr_minutes##',
                    (
                      (adjustedQuantity *
                        (parseInt(price.metadata?.nlp_seconds_limit || '0') ||
                          parseInt(
                            price.prices.metadata?.nlp_seconds_limit || '0'
                          ))) /
                      60
                    ).toLocaleString()
                  )
                  .replace(
                    '##plan_interval##',
                    price.prices.recurring!.interval
                  )}
              </li>
              <li>
                <div className={styles.iconContainer}>
                  <Icon
                    name='check'
                    size='m'
                    color={price.prices.unit_amount ? 'teal' : 'storm'}
                  />
                </div>
                {t(
                  '##mt_characters## characters of machine translation /##plan_interval##'
                )
                  .replace(
                    '##mt_characters##',
                    (
                      adjustedQuantity *
                      (parseInt(price.metadata?.nlp_character_limit || '0') ||
                        parseInt(
                          price.prices.metadata?.nlp_character_limit || '0'
                        ))
                    ).toLocaleString()
                  )
                  .replace(
                    '##plan_interval##',
                    price.prices.recurring!.interval
                  )}
              </li>
            </>
          )}
          {Object.keys(price.metadata).map(
            (featureItem: string) =>
              featureItem.includes('feature_list_') && (
                <li key={featureItem}>
                  <div className={styles.iconContainer}>
                    <Icon
                      name='check'
                      size='m'
                      color={price.prices.unit_amount ? 'teal' : 'storm'}
                    />
                  </div>
                  {getFeatureMetadata(price, featureItem)}
                </li>
              )
          )}
        </ul>
        {expandComparison && (
          <div className={styles.expandedContainer}>
            <hr />
            {state.featureTypes.map((type, index, array) => {
              const featureItem = getListItem(type, price.name);
              return (
                featureItem.length > 0 && [
                  returnListItem(
                    type,
                    price.name,
                    price.metadata[`feature_${type}_title`]
                  ),
                  index !== array.length - 1 && <hr key={`hr-${type}`} />,
                ]
              );
            })}
          </div>
        )}
        <PlanButton
          price={price}
          downgrading={
            activeSubscriptions?.length > 0 &&
            activeSubscriptions?.[0].items?.[0].price.unit_amount >
              price.prices.unit_amount
          }
          quantity={submissionQuantity}
          isSubscribedToPlan={isSubscribedProduct(price, submissionQuantity)}
          buySubscription={buySubscription}
          showManage={shouldShowManage(price)}
          isBusy={isDisabled}
          setIsBusy={setIsBusy}
          organization={state.organization}
        />
      </div>
    </>
  );
};
