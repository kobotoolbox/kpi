import type {SubscriptionInfo} from 'jsapp/js/account/stripe.types';
import type {EnvStoreData} from 'jsapp/js/envStore';

/** Only use this directly for complex cases/strings (for example, possessive case).
 * Otherwise, use getSimpleMMOLabel.
 * @param {EnvStoreData} envStoreData
 * @param {SubscriptionInfo} subscription
 * @returns boolean indicating whether an MMO should be referred to as a 'team' or as an 'organization
 */
export function shouldUseTeamLabel(
  envStoreData: EnvStoreData,
  subscription: SubscriptionInfo | null
) {
  return subscription
    ? subscription.items[0].price.product.metadata?.use_team_label === 'true'
    : envStoreData.use_team_label;
}

/**
 * @param {EnvStoreData} envStoreData
 * @param {SubscriptionInfo} subscription
 * @param {boolean} plural
 * @param {boolean} capitalize
 * @returns Translated string for referring to MMO as 'team' or 'organization'
 * */
export function getSimpleMMOLabel(
  envStoreData: EnvStoreData,
  subscription: SubscriptionInfo | null,
  plural: boolean = false,
  capitalize: boolean = false
) {
  if (shouldUseTeamLabel(envStoreData, subscription)) {
    if (plural) {
      return capitalize ? t('Teams') : t('teams');
    }
    return capitalize ? t('Team') : t('team');
  }

  if (plural) {
    return capitalize ? t('Organizations') : t('organizations');
  }
  return capitalize ? t('Organization') : t('organization');
}
