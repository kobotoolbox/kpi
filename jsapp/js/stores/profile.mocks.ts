import { runInAction } from 'mobx'
import type { AccountResponse } from '#/dataInterface'
import { meMockResponse } from '#/endpoints/me.mocks'
import { ANON_USERNAME } from '#/users/utils'
import profileStore from './profile'

/**
 * Sets the `profileStore` singleton to a settled, logged-in state matching the
 * globally registered `/me/` mock (see `.storybook/preview.tsx`).
 *
 * Why? `profileStore` calls `verifyLogin()` in its constructor, so the `/me/`
 * request fires on import and can lose the race against the MSW worker
 * starting up. When it does, the request hits the real server, fails, and
 * the store stays anonymous, leaving anything gated on the session stuck on
 * a loading spinner.
 */
export function hydrateProfileStoreForStories() {
  runInAction(() => {
    profileStore.currentAccount = meMockResponse as unknown as AccountResponse
    profileStore.isAuthStateKnown = true
    profileStore.isLoggedIn = true
    profileStore.isInitialLoadComplete = true
    profileStore.isPending = false
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
 * No `/me/` override needed - `profileStore` only calls `verifyLogin()` once, on import.
 */
export function setAnonymousProfileForStories() {
  runInAction(() => {
    profileStore.currentAccount = { username: ANON_USERNAME, date_joined: '' }
    profileStore.isAuthStateKnown = true
    profileStore.isLoggedIn = false
    profileStore.isInitialLoadComplete = true
    profileStore.isPending = false
  })

  return hydrateProfileStoreForStories
}
