import { runInAction } from 'mobx'
import type { AccountResponse } from '#/dataInterface'
import { meMockResponse } from '#/endpoints/me.mocks'
import sessionStore from './session'

/**
 * Sets the `sessionStore` singleton to a settled, logged-in state matching the
 * globally registered `/me/` mock (see `.storybook/preview.tsx`).
 *
 * Why? `sessionStore` calls `verifyLogin()` in its constructor, so the `/me/`
 * request fires on import and can lose the race against the MSW worker
 * starting up. When it does, the request hits the real server, fails, and
 * the store stays anonymous, leaving anything gated on the session stuck on
 * a loading spinner.
 */
export function hydrateSessionStoreForStories() {
  runInAction(() => {
    sessionStore.currentAccount = meMockResponse as unknown as AccountResponse
    sessionStore.isAuthStateKnown = true
    sessionStore.isLoggedIn = true
    sessionStore.isInitialLoadComplete = true
    sessionStore.isPending = false
  })
}
