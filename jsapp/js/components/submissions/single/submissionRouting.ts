import type { AssetsDataListParams } from '#/api/models/assetsDataListParams'
import type { TableFilterQuery } from '#/components/submissions/tableUtils'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import { addDefaultUuidPrefix } from '#/utils'

/** The screen a record was opened from, and what to call it. */
export interface SubmissionBackTo {
  path: string
  /** Already translated - only the screen being left knows what it is called. */
  label: string
}

/**
 * Extra state we hand to the submission route when we open it ourselves. None of
 * it is part of the address, so a shared or bookmarked link arrives without any
 * of it - the route has to cope with each of these being missing.
 */
export interface SubmissionRouteState {
  /** Set right after a duplicate was created, to explain what just happened. */
  duplicatedFromUuid?: string
  /** Where "Back" should lead. Absent means the data table, see the route. */
  backTo?: SubmissionBackTo
}

/**
 * Describes the screen the user is on right now, to be passed as route state when
 * opening a record from it. Captures the address as it stands, so returning also
 * restores whatever it holds - the map's "view by" question, for one.
 *
 * Returns nothing before the app has rendered, in which case the record falls
 * back to offering the data table.
 */
export function getBackToCurrentScreen(label: string): SubmissionBackTo | undefined {
  const location = router?.state.location

  if (!location) {
    return undefined
  }

  return { path: location.pathname + location.search, label }
}

/**
 * The address of a single submission record, e.g.
 * `#/forms/aBcDeF/data/submission/a1b2c3d4-…`.
 *
 * @param submissionId - `meta/rootUuid` (preferably) or `_id`
 */
export function getSubmissionPath(assetUid: string, submissionId: string | number) {
  return ROUTES.FORM_SUBMISSION.replace(':uid', assetUid).replace(
    ':submissionId',
    encodeURIComponent(String(submissionId)),
  )
}

/**
 * Opens a submission record. Exists for the legacy class components that cannot
 * use `useNavigate`.
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
 * Fetches the single neighbouring submission in either direction.
 *
 * Submissions are listed newest first (the API sorts by `{"_id":-1}`), so "next"
 * means an older record, i.e. a lower `_id`. Cursoring on `_id` rather than time
 * is what makes this possible at all: submission times are only accurate to the
 * second, so they cannot break ties. `SelectSubmission` does the same.
 *
 * @param filterQuery - The data table's filters, so that stepping between records
 * stays within the list the user was looking at. They are not part of the address,
 * so a shared link steps through everything the recipient can see.
 */
export function getSubmissionNeighborParams(
  submissionDbId: number,
  direction: 'prev' | 'next',
  filterQuery?: TableFilterQuery['queryObj'],
): AssetsDataListParams {
  const isNext = direction === 'next'
  const cursorQuery = { _id: { [isNext ? '$lt' : '$gt']: submissionDbId } }
  const hasFilters = filterQuery !== undefined && Object.keys(filterQuery).length > 0

  return {
    limit: 1,
    start: 0,
    // `$and` rather than one merged object, as the table can filter on `_id` too.
    query: JSON.stringify(hasFilters ? { $and: [filterQuery, cursorQuery] } : cursorQuery),
    sort: JSON.stringify({ _id: isNext ? -1 : 1 }),
  }
}
