import type {BaseSubscription, Product, Organization} from './stripe.api';

export type PlanDataAction =
  | {type: 'initialProduct'; data: Product[]}
  | {type: 'initialOrganization'; data: Organization}
  | {type: 'initialSubscribed'; data: BaseSubscription[]}
  | {type: 'month'}
  | {type: 'year'};
