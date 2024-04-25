import {useCallback, useEffect, useState} from 'react';

export interface ApiFetcherOptions {
  /* If set, the ApiFetcher will execute the fetcher() function once per the
   * provided number of seconds. Will only fetch when the window is visible.
   * *Don't* use this for fetches that mutate data on the server (POST, DELETE, PUT).
   */
  reloadEverySeconds: number;
  skipInitialLoad: boolean;
}

export type Fetcher<Type> = (...fetcherArgs: any) => Promise<Type | undefined>;

export interface ApiFetcherArgs<Type> {
  fetcher: Fetcher<Type>; //(fetcherArgs?: Record<string, any>) => Promise<Type | undefined>,
  initialValue: Type;
  options?: Partial<ApiFetcherOptions>;
  args?: Parameters<typeof this.fetcher>;
}

export interface ApiFetcherStatus {
  pending: boolean;
  error: string | null;
  isInitialLoad: boolean;
  setIsInitialLoad: (isInitialLoad: boolean) => void;
}

export type WithApiFetcher<Type> = [Type, () => void, ApiFetcherStatus];

const MAX_FETCHER_CACHE_LENGTH = 20;

export function useApiFetcher<Type>({
  fetcher,
  initialValue,
  options,
  args = [],
}: ApiFetcherArgs<Type>): WithApiFetcher<Type> {
  const [state, setState] = useState<Type>(initialValue);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<Array<{key: string; data: Type}> | []>([]);

  const setCacheEntry = useCallback(
    (cacheKey: string, data: Type) => {
      const newCache = [...cache];
      if (newCache.length > MAX_FETCHER_CACHE_LENGTH) {
        // let's not let the list of cache entries grow unbounded
        newCache.shift();
      }
      setCache(cache.concat({data, key: cacheKey}));
    },
    [cache]
  );

  const loadFetcher = useCallback(() => {
    setPending(true);
    // use stale-while-revalidate logic: if we have a cached value, use that until
    // we get a fresh response from the server
    const cacheKey = JSON.stringify(args);
    const cachedData = cache?.[cacheKey];
    if (typeof cachedData !== 'undefined') {
      setState(cachedData);
    }
    fetcher()
      .then((data) => {
        setState(data);
        setIsInitialLoad(false);
        setPending(false);
        setError(null);
        setCacheEntry(cacheKey, data);
      })
      .catch((reason) => {
        setState(initialValue);
        setPending(false);
        setError(reason);
      });
  }, [args]);

  // load the fetcher once when the component is mounted
  useEffect(() => {
    if (!options?.skipInitialLoad) {
      loadFetcher();
    }
  }, [options?.skipInitialLoad]);

  useEffect(() => {
    if (options?.reloadEverySeconds) {
      const intervalId = setInterval(() => {
        // only reload if the tab is visible
        if (document.visibilityState === 'visible') {
          loadFetcher();
        }
      }, options.reloadEverySeconds * 1000);
      return () => {
        clearInterval(intervalId);
      };
    }
    return;
  }, [options]);

  return [
    state,
    loadFetcher,
    {pending, error, isInitialLoad, setIsInitialLoad},
  ];
}

export const withApiFetcher = <Type>(
  initialState: Type
): WithApiFetcher<Type> => {
  return [
    initialState,
    () => {},
    {
      pending: true,
      error: null,
      isInitialLoad: true,
      setIsInitialLoad: () => {},
    },
  ];
};
