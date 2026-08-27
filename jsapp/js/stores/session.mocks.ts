import { runInAction } from 'mobx'
import type { AccountResponse } from '#/dataInterface'
import { meMockResponse } from '#/endpoints/me.mocks'
import { ANON_USERNAME } from '#/users/utils'
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

/**
 * A settled, anonymous session, for stories of screens a visitor sees before logging in - the
 * authentication views.
 *
 * Use it as a story's `beforeEach` and let Storybook call the returned teardown. The teardown isn't
 * optional: `preview.tsx` forces the logged-in state in a project-level `beforeEach` that runs before
 * a story's own, so nothing else would put it back for the next story.
 *
 * No `/me/` override needed - `sessionStore` only calls `verifyLogin()` once, on import.
 */
export function setAnonymousSessionForStories() {
  runInAction(() => {
    sessionStore.currentAccount = { username: ANON_USERNAME, date_joined: '' }
    sessionStore.isAuthStateKnown = true
    sessionStore.isLoggedIn = false
    sessionStore.isInitialLoadComplete = true
    sessionStore.isPending = false
  })

  return hydrateSessionStoreForStories
}
