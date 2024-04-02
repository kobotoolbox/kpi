import {useCallback, useEffect, useState} from 'react';

export interface ApiFetcherOptions {
  /* If set, the ApiFetcher will execute the fetch() function once per the
   * provided number of seconds. Will only fetch when the window is visible.
   * *Don't* use this for fetches that mutate data on the server (POST, DELETE, PUT).
   */
  reloadEverySeconds: number;
  skipInitialLoad: boolean;
}

export type WithApiFetcher<Type> = [
  Type,
  () => void,
  {
    pending: boolean;
    error: string | null;
    isInitialLoad: boolean;
    setIsInitialLoad: (isInitialLoad: boolean) => void;
  }
];

export function useApiFetcher<Type>(
  fetcher: () => Promise<Type | undefined>,
  initialValue: Type,
  options?: Partial<ApiFetcherOptions>
): WithApiFetcher<Type> {
  const [state, setState] = useState<Type>(initialValue);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFetcher = useCallback(() => {
    setPending(true);
    fetcher()
      .then((data) => {
        setState(data ?? initialValue);
        setIsInitialLoad(false);
        setPending(false);
        setError(null);
      })
      .catch((reason) => {
        setState(initialValue);
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
