/* eslint-disable import/export */
// ^^ eslint doesn't understand direct exports.

export * from './user-team-organization-usage'
export * from './survey-data'

/**
 * Write at least invalidation for every mutation in use.
 * Optimistic updates are optional, requires different UX approach and often is just an overkill.
 * See when NOT to use optimistic update: https://tkdodo.eu/blog/mastering-mutations-in-react-query#optimistic-updates
 *
 * Generally, when writing invalidation only:
 * - onSettled: invalidate affected queries
 *
 * Generally, when writing both invalidation & optimistic updates:
 * - onMutate:
 *  - cancel ongoing fetches for affected queries (to avoid race-conditions)
 *  - perform optimistic updates for affected queries
 * - onError: rollback optimistic updates
 * - onSettled: invalidate affected queries
 */
