/**
 * In URL use value, not key of enum.
 * For our sanity, use camel case and match key with value.
 */
export enum FeatureFlag {
  exampleFeatureEnabled = 'exampleFeatureEnabled', //Comment out when we have active FFs
}

/**
 * This function reads query parameters and processes them to find feature flags
 * - The query parameters are read from the URL
 * - Recommended naming convention: `ff_featureNameEnabled`
 * - Any parameter starting with "ff_" is considered to be a feature flag
 * - A feature flag parameter needs to have its value equals "true" to be set to true
 * - Enabled flags are stored on sessionStorage by its name **without the ff_**
 * - Disabled (false) flags are removed from the sessionStorage object
 * - A flag won't disable itself unless it's set to false or the sessionStorage object is deleted (manually or by session ending)
 *
 *  Uses:
 * - Destructuring
 *  ```js
 *    // https://kf.kobotoolbox.org/#/projects/home?ff_featureNameEnable=true&ff_featureNameEnable2=true
 *    const {featureNameEnabled} = getFeatureFlags()
 *    console.log(featureNameEnabled) // true
 *  ```
 *
 * - Full object
 *  ```
 *    // https://kf.kobotoolbox.org/#/projects/home?ff_featureNameEnable=true&ff_featureNameEnable2=true
 *    const flags = getFeatureFlags()
 *    console.log(flags) // {featureNameEnable: true, featureNameEnable2: true}
 *  ```
 *
 * @returns {Record<FeatureFlag, boolean>} Object containing enabled flags as entries set as true
 */
const getFeatureFlags = (): Record<FeatureFlag, boolean> => {
  const flags = JSON.parse(sessionStorage.getItem('feature_flags') || '{}');

  // Due hash router used for kobo this fails to resolve the search parameters,
  // so we need to remove the hash from the URL
  const params = new URL(window.location.href.replace('/#', '')).searchParams;

  if (params.size === 0) {
    return flags;
  }

  const newFlags: Partial<Record<FeatureFlag, boolean>> = {};
  for (const [key, value] of params) {
    if (!key.startsWith('ff_')) {
      continue;
    }

    const flag = key.slice(3);
    if (!Object.values(FeatureFlag).includes(flag as FeatureFlag)) {
      continue;
    }
    // A flag will be removed from storage if set to anything different from 'true'
    newFlags[flag as FeatureFlag] = value === 'true' ? true : undefined;
  }

  const totalFlags = {
    ...flags,
    ...newFlags,
  };

  sessionStorage.setItem('feature_flags', JSON.stringify(totalFlags));

  // Stringifying and re-parsing to clean up undefined keys
  return JSON.parse(sessionStorage.getItem('feature_flags')!);
};

/**
 * This should only be used if a hook can't be used.
 * See description of {@link useFeatureFlag}.
 *
 * @deprecated use {@link useFeatureFlag} instead.
 */
export const checkFeatureFlag = (flag: FeatureFlag): boolean =>
  !!getFeatureFlags()[flag];

/**
 * This hook is used to check if a feature flag is enabled.
 * It uses the {@link getFeatureFlags} function to get the flags.
 *
 * - The query parameters from the URL are processed to find feature flags
 * - Recommended parameter naming convention: `ff_featureNameEnabled`
 * - Any query parameter starting with "ff_" is considered to be a feature flag
 * - A feature flag parameter needs to have its value equals "true" to be set to true
 * - Enabled flags are stored on session and will keep their state even if the query param is no longer present
 * - This hook will return true if the given flag is enabled
 *
 * Use:
 * ```
 * // https://kf.kobotoolbox.org/#/projects/home?ff_featureNameEnable=true&ff_featureNameEnable2=true
 *
 * const isFeatureEnabled = useFeatureFlag(FeatureFlag.featureNameEnabled);
 * console.log(isFeatureEnabled) // true
 * ```
 * - If you can't use the hook, use the {@link checkFeatureFlag} function.
 *
 * P.S. For future-proofness when we will use a proper feature flag service, this hook should be easy to adapt.
 *
 * @param {FeatureFlag} flag - The feature flag to check
 *
 * @returns {boolean} - True if the feature flag is enabled
 */
export const useFeatureFlag = (flag: FeatureFlag): boolean =>
  checkFeatureFlag(flag);
