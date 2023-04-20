import type {PlanDataAction} from './planData.actions';

import type {
  BaseSubscription,
  Product,
  Organization,
} from './stripe.api';

interface PlanState {
  isLoading: boolean;
  subscribedProduct?: BaseSubscription[];
  intervalFilter: string;
  filterToggle: boolean;
  products: Product[];
  organization?: Organization;
  featureTypes: string[];
}

export const initialState: PlanState = {
  isLoading: true,
  subscribedProduct: undefined,
  intervalFilter: 'year',
  filterToggle: false,
  products: [],
  organization: undefined,
  featureTypes: ['support', 'advanced', 'addons'],
};

export function planReducer(state: PlanState, action: PlanDataAction): PlanState
    {
    switch (action.type) {
      case 'initialProduct':
        return {...state, products: action.data};
      case 'initialOrganization':
        return {...state, organization: action.data};
      case 'initialSubscribed':
        return {...state, subscribedProduct: action.data};
      case 'month':
        return {
          ...state,
          intervalFilter: 'month',
          filterToggle: !state.filterToggle,
        };
      case 'year':
        return {
          ...state,
          intervalFilter: 'year',
          filterToggle: !state.filterToggle,
        };
      default:
        return state;
    }
  }
