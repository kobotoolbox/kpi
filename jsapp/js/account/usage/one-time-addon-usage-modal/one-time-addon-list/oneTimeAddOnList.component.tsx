import React, {useContext, useMemo, useState} from 'react';
import styles from './oneTimeAddOnUsageModal.module.scss';
import {
  OneTimeAddOn,
  USAGE_TYPE,
} from 'jsapp/js/account/stripe.types';
import { ProductsContext } from 'jsapp/js/account/useProducts.hook';

interface OneTimeAddOnList {
  type: USAGE_TYPE;
  oneTimeAddons: OneTimeAddOn[];
}

function OneTimeAddOnList(props: OneTimeAddOnList) {
  const productsContext = useContext(ProductsContext);

  return (
    <div>
      {props.oneTimeAddons.map((addon, i) => (
        <div key={i}>
          {addon.product}
          {addon.limits_remaining.mt_characters_limit}
        </div>
      ))}
    </div>
  );
}

export default OneTimeAddOnList;
