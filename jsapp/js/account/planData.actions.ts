import type {
  BaseSubscription,
  Product,
  Organization,
} from './stripe.api';

export type PlanDataAction =
  | {type: 'initialProduct'; data: Product[];}
  | {type: 'initialOrganization'; data: Organization;}
  | {type: 'initialSubscribed'; data: Array<BaseSubscription>;}
  | {type: 'month'}
  | {type: 'year';};
