import {useEffect} from 'react';
import {ApiFetcherStatus} from 'js/hooks/useApiFetcher.hook';

/*
 * Use this hook to refresh an ApiFetcher hook whenever a page is reloaded.
 * Won't cause double loads on initial page load.
 */
export const useRefreshApiFetcher = (
  load: () => void,
  status: ApiFetcherStatus
) => {
  useEffect(() => {
    if (status.isInitialLoad && !status.pending) {
      load();
    }
  }, [status]);

  useEffect(() => {
    return () => {
      status.setIsInitialLoad(true);
    };
  }, []);
};
