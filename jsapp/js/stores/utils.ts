/**
 * A higher-order function that takes a jQuery XHR request callback and returns a cached function
 * Cached function will only execute once per page load, or when `refresh` is true
 * Prevents multiple copies of a listener from firing at the same time for the same arguments
 **/
export const cacheDataInterface = (
  callback: (params: Record<string, any>) => JQuery.jqXHR<any>,
  onCallbackDone: Function,
  onCallbackFail: Function
) => {
  // we initialize the cache here so that it gets stored as a closure with the returned function
  const responseCache: Record<string, any> = {};
  const cachedCallback = (params: Record<string, any>, refresh = false) => {
    // turn the params object into a string to use it as the cache key
    const cacheKey = JSON.stringify(params);
    if (refresh || !(cacheKey in responseCache)) {
      // initialize the cache entry with an empty value, or evict stale cached entry for this asset
      // we use a string instead of null/undefined to distinguish from null responses from the server, etc.
      responseCache[cacheKey] = 'pending';
      callback(params)
        .done((res) => {
          // save the fully loaded response to the cache
          responseCache[cacheKey] = res;
          onCallbackDone(res);
        })
        .fail((res) => onCallbackFail(res));
    } else if (responseCache[cacheKey] !== 'pending') {
      // we have a cache entry, use it
      onCallbackDone(responseCache[cacheKey]);
    }
    // the cache entry for this action is currently pending, do nothing
  };
  return cachedCallback;
};
