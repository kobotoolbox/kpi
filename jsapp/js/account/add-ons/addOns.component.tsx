import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import styles from './plan.module.scss';
import {
  getOrganization,
  getProducts,
  postCheckout,
  postCustomerPortal,
} from '../stripe.api';
import Button from 'js/components/common/button';
import classnames from 'classnames';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {notify} from 'js/utils';
import {ACTIVE_STRIPE_STATUSES} from 'js/constants';
import type {FreeTierThresholds} from 'js/envStore';
import envStore from 'js/envStore';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import useWhen from 'js/hooks/useWhen.hook';
import AddOnList from 'js/account/plans/addOnList.component';
import subscriptionStore from 'js/account/subscriptionStore';
import {when} from 'mobx';
import {
  getSubscriptionsForProductId,
  isDowngrade,
  processCheckoutResponse,
} from 'js/account/stripe.utils';
import type {
  BasePrice,
  Organization,
  Price,
  Product,
  SubscriptionInfo,
} from 'js/account/stripe.types';
import type {ConfirmChangeProps} from 'js/account/plans/confirmChangeModal.component';
import ConfirmChangeModal from 'js/account/plans/confirmChangeModal.component';
import Session from 'js/stores/session';
import InlineMessage from 'js/components/common/inlineMessage';
import {PlanContainer} from 'js/account/plans/planContainer.component';


export default function addOns() {
  

  return (
    <>
      Account add-ons page in progress
    </>
  );
}
