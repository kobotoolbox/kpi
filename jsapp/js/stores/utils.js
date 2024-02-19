import SparkMD5 from 'spark-md5';

/**
 * A higher-order function that returns a cached listener function
 * Cached function will only execute once per page load, or when `refresh` is true
 * Prevents multiple copies of a listener from firing at the same time for the same arguments
 **/
export const cacheAction = (callback, onDone, onFail) => {
  // we initialize the cache here so it gets stored as a closure with the returned function
  const responseCache = {};
  const cachedCallback = (params, refresh = false) => {
    // get a hash of the parameters so we can construct a fixed-length cache key
    const paramsHash = SparkMD5.hash(JSON.stringify(params));
    if (refresh || !(paramsHash in responseCache)) {
      // initialize the cache entry with an empty value, or evict stale cached entry for this asset
      // we use a string instead of null/undefined to distinguish from null responses from the server, etc.
      responseCache[paramsHash] = 'pending';
      callback(params)
        .done((res) => {
          // save the fully loaded response to the cache
          responseCache[paramsHash] = res;
          onDone(res);
        })
        .fail(onFail);
    } else if (responseCache[paramsHash] !== 'pending') {
      // we have a cache entry, use it
      onDone(responseCache[paramsHash]);
    }
    // the cache entry for this action is currently pending, do nothing
  };
  return cachedCallback;
};
