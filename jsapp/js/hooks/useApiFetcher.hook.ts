import {useCallback, useEffect, useState} from 'react';

export interface ApiFetcherOptions {
  /* If set, the ApiFetcher will execute the fetch() function once per the
   * provided number of seconds. Will only fetch when the window is visible.
   * *Don't* use this for fetches that mutate data on the server (DELETE, PUT, some POST requests).
   */
  reloadEverySeconds?: number;
  skipInitialLoad?: boolean;
}

export interface ApiFetcherStatus {
  pending: boolean;
  error: string | null;
  isInitialLoad: boolean;
  setIsInitialLoad: (isInitialLoad: boolean) => void;
}

export type WithApiFetcher<Type> = [Type, () => void, ApiFetcherStatus];

/** A reusable hook for making simple fetches with a consistent API.
 *
 * Made to be easily used alongside the Context API - for a simple
 * example, look at `useOrganization` and `OrganizationContext`.
 *
 * It's heavily patterned off of swr: https://github.com/vercel/swr
 * But only has a small subset of its features of interest to us.
 *
 * @function
 * @template Type
 * @param {function} fetcher Makes an API request and returns a data
 *  object. `useApiFetcher` will call this whenever it needs a fresh
 *  API response.
 * @returns {Promise<Type|undefined>}
 *
 * @param {Type} initialValue Will be returned by useApiFetcher
 *  during the initial load or if there's an error while fetching.
 *
 * @param {ApiFetcherOptions} options Setup options for the hook.
 * */
export const useApiFetcher = <Type>(
  fetcher: () => Promise<Type | undefined>,
  initialValue: Type,
  options?: ApiFetcherOptions
): WithApiFetcher<Type> => {
  const [response, setResponse] = useState<Type>(initialValue);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFetcher = useCallback(() => {
    setPending(true);
    fetcher()
      .then((data) => {
        setResponse(data ?? initialValue);
        setIsInitialLoad(false);
        setPending(false);
        setError(null);
      })
      .catch((reason) => {
        setResponse(initialValue);
        setPending(false);
        setError(reason);
      });
  }, [fetcher]);

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
    response,
    loadFetcher,
    {pending, error, isInitialLoad, setIsInitialLoad},
  ];
};

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
