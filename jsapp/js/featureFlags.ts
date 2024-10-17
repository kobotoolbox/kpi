
/**
 * This function reads query parameters and processes them to find feature flags
 * - Any parameter starting with "ff_" is considered to be a feature flag
 * - A feature flag parameter needs to have its value equals "true" to be set to true
 * - Enabled flags are stored on sessionStorage by its name (without the ff_)
 * - Disabled (false) flags are removed from the sessionStorage object
 * - A flag won't disable itself unless it's set to false or the sessionStorage object is deleted
 * - If no flags are enabled, the session storage object is removed
 *
 *  Uses:
 * - Destructuring
 *  ```
 *    const {secret_function} = getFeatureFlags()`
 *    if( secret_function ) ...
 *  ```
 *
 * - Full object
 *  ```
 *    const flags = getFeatureFlags()
 *    if( flags.secret_function ) ...
 *  ```
 *
 * @returns {Record<string, boolean>} Object containing enabled flags as entries set as true
 */
export const getFeatureFlags = (): Record<string, boolean> => {

  const flags = JSON.parse(sessionStorage.feature_flags || '{}');

  // The # needs to be removed or the URL is not properly processed
  const params = new URL(window.location.href.replace('/#', '')).searchParams;

  params.forEach((value, key) => {
    if (key.startsWith('ff_')) {
      const flag = key.slice(3);
      if (value === 'true') {
        flags[flag] = true;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete flags[flag];
      }
    }
  });

  if (Object.keys(flags).length === 0) {
    sessionStorage.removeItem('feature_flags');
  } else {
    sessionStorage.feature_flags = JSON.stringify(flags);
  }

  return flags;

};
