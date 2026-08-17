import type { AssetsDataListParams } from '#/api/models/assetsDataListParams'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import { addDefaultUuidPrefix } from '#/utils'

/**
 * Extra state we hand to the submission route when we open it ourselves. It is
 * lost on reload, which is fine - it only drives a transient banner.
 */
export interface SubmissionRouteState {
  /** Set right after a duplicate was created, to explain what just happened. */
  duplicatedFromUuid?: string
}

/**
 * The address of a single submission record, e.g.
 * `#/forms/aBcDeF/data/submission/a1b2c3d4-…`.
 *
 * Prefer a root UUID: it survives edits, while `_id` is a database key. Numeric
 * ids still work, for older links and for callers that only have an `_id` (the
 * REST Service logs).
 */
export function getSubmissionPath(assetUid: string, submissionId: string | number) {
  return ROUTES.FORM_SUBMISSION.replace(':uid', assetUid).replace(':submissionId', String(submissionId))
}

/**
 * Opens a submission record. Exists for the legacy class components that still
 * render the data table and the map, and so cannot use `useNavigate`.
 */
export function goToSubmission(
  assetUid: string,
  submissionId: string | number,
  options: { replace?: boolean; state?: SubmissionRouteState } = {},
) {
  // `router` is only injected once the app has rendered.
  if (!router) {
    return
  }

  router.navigate(getSubmissionPath(assetUid, submissionId), {
    replace: options.replace,
    state: options.state,
  })
}

/** Where the "back to data" affordance of the submission route points. */
export function getDataTablePath(assetUid: string) {
  return ROUTES.FORM_TABLE.replace(':uid', assetUid)
}

/**
 * Query params that resolve whatever the route was given into one record.
 *
 * A root UUID is matched against both `meta/rootUuid` and `_uuid`, because
 * submissions predating `meta/rootUuid` only have the latter. Numeric ids are
 * matched as `_id`.
 */
export function getSubmissionLookupParams(submissionId: string): AssetsDataListParams {
  const isNumericId = /^\d+$/.test(submissionId)

  const query = isNumericId
    ? { _id: Number(submissionId) }
    : {
        $or: [{ 'meta/rootUuid': addDefaultUuidPrefix(submissionId) }, { _uuid: submissionId }],
      }

  return { limit: 1, start: 0, query: JSON.stringify(query) }
}

/**
 * Fetches the single neighbouring submission in either direction, and - through
 * the response's `count` - how many lie that way.
 *
 * Submissions are listed newest first (the API sorts by `{"_id":-1}`), so "next"
 * means an older record, i.e. a lower `_id`. Cursoring on `_id` rather than time
 * is what makes this possible at all: submission times are only accurate to the
 * second, so they cannot break ties. `SelectSubmission` does the same.
 *
 * This walks *all* submissions the user can see, not the subset the data table
 * may be filtered down to - filters live in the table's own component state and
 * are not part of a submission's address.
 */
export function getSubmissionNeighborParams(submissionDbId: number, direction: 'prev' | 'next'): AssetsDataListParams {
  const isNext = direction === 'next'

  return {
    limit: 1,
    start: 0,
    query: JSON.stringify({ _id: { [isNext ? '$lt' : '$gt']: submissionDbId } }),
    sort: JSON.stringify({ _id: isNext ? -1 : 1 }),
  }
}
