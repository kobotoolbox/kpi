/* eslint-disable import/export */
// ^^ eslint doesn't understand direct exports.

export * from './manage-projects-and-library-content'
export * from './user-team-organization-usage'
export * from './survey-data'

import { queryClient } from '../queryClient'
import { applyManageProjectsMutationDefaults } from './manage-projects-and-library-content'
import { applySurveyDataMutationDefaults } from './survey-data'
import { applyUserTeamOrganizationMutationDefaults } from './user-team-organization-usage'

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

// Apply all mutation defaults to the global queryClient
// These functions are also exported so they can be applied to test/story queryClients
applySurveyDataMutationDefaults(queryClient)
applyManageProjectsMutationDefaults(queryClient)
applyUserTeamOrganizationMutationDefaults(queryClient)
