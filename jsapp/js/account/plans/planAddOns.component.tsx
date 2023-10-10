import React, {useEffect, useState} from 'react';
import useWhen from 'js/hooks/useWhen.hook';
import type {SubscriptionInfo} from 'js/account/subscriptionStore';
import subscriptionStore from 'js/account/subscriptionStore';
import type {BasePrice, Product} from 'js/account/stripe.api';

const PlanAddOns = (props: {products: Product[]}) => {
  const [subscribedAddOns, setSubscribedAddOns] = useState<SubscriptionInfo[]>(
    []
  );
  const [addOnPrices, setAddOnPrices] = useState<BasePrice[]>([]);
  const [addOnProducts, setAddOnProducts] = useState<Product[]>([]);

  /**
   * Extract the add-on products and prices from the list of all products
   */
  useEffect(() => {
    const addonProducts = props.products.filter(isAddonProduct);
    const addOnPrices = addonProducts
      .map((product) => [...product.prices])
      .reduce((first, second) => first.concat(second))
      // TODO: remove the next line when one-time add-ons are ready
      .filter((price) => price?.recurring);
    setAddOnPrices(addOnPrices);
    setAddOnProducts(addonProducts);
  }, [props.products]);

  useWhen(
    () => subscriptionStore.isInitialised,
    () => {
      setSubscribedAddOns(subscriptionStore.addOnsResponse);
    },
    []
  );

  const isAddonProduct = (product: Product) =>
    product.metadata.product_type === 'addon';

  if (!addOnPrices) {
    return null;
  }

  return (
    <table>
      <tbody>
        {addOnPrices.map((price) => (
          <tr key={price.id}>
            <td>{price.nickname}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default PlanAddOns;
