import {useCallback, useEffect, useState} from 'react';

export interface ApiFetcherOptions {
  /* If set, the ApiFetcher will execute the fetch() function once per the
   * provided number of seconds. Will only fetch when the window is visible.
   * *Don't* use this for fetches that mutate data on the server (DELETE, PUT,
   * non-idempotent POST requests).
   */
  reloadEverySeconds?: number;
  skipInitialLoad?: boolean;
}

interface Status {
  pending: boolean;
  error: string | null;
  isInitialLoad: boolean;
}

export interface ApiFetcherStatus extends Status {
  setIsInitialLoad: (isInitialLoad: boolean) => void;
}

export type WithApiFetcher<Type> = [Type, () => void, ApiFetcherStatus];

/**
 * A reusable hook for making simple fetches with a consistent API.
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
 *
 * @deprecated Use react-query instead. See `useOrganizationQuery` for a simple example.
 * */
export const useApiFetcher = <Type>(
  fetcher: () => Promise<Type | undefined>,
  initialValue: Type,
  options?: ApiFetcherOptions
): WithApiFetcher<Type> => {
  const [response, setResponse] = useState<Type>(initialValue);
  const [status, setStatus] = useState<Status>({
    error: null,
    pending: true,
    isInitialLoad: false,
  });

  const loadFetcher = useCallback(() => {
    setStatus((prevState) => {
      return {...prevState, pending: true};
    });
    fetcher()
      .then((data) => {
        setResponse(data ?? initialValue);
        setStatus({error: null, isInitialLoad: false, pending: false});
      })
      .catch((error) => {
        setResponse(initialValue);
        setStatus((prevState) => {
          return {...prevState, error: error?.message, pending: false};
        });
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

  const setIsInitialLoad = (value: boolean) => {
    setStatus((prevState) => {
      return {...prevState, isInitialLoad: value};
    });
  };

  return [response, loadFetcher, {...status, setIsInitialLoad}];
};

/**
 * @deprecated convert to functional component and use react-query instead.
 * See `useOrganizationQuery` for a simple example.
 */
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
