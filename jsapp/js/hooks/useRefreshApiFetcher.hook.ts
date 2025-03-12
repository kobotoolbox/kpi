import { useEffect } from 'react'

import type { ApiFetcherStatus } from '#/hooks/useApiFetcher.hook'

/*
 * Use this hook to refresh an ApiFetcher hook whenever a page is reloaded.
 * Won't cause double loads on initial page load.
 */
export const useRefreshApiFetcher = (load: () => void, status: ApiFetcherStatus) => {
  useEffect(() => {
    if (status.isInitialLoad && !status.pending) {
      load()
    }
  }, [status])

  useEffect(
    () => () => {
      status.setIsInitialLoad(true)
    },
    [],
  )
}
