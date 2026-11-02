import type { AssetsDataListParams } from '#/api/models/assetsDataListParams'
import type { PaginatedDataResponseListCount } from '#/api/models/paginatedDataResponseListCount'
import type { TableFilterQuery } from '#/components/submissions/tableUtils'
import { getSubmissionsSortQuery } from '#/dataInterface'
import type { SubmissionsSort } from '#/dataInterface'
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
  /**
   * Opened from the data table, so shown in a modal over it. The table stays
   * mounted underneath, and closing goes back to it.
   */
  asModal?: boolean
  /** Where the record sits in the list it was opened from. Only the table sets it. */
  listPosition?: SubmissionListPosition
}

/**
 * A record's place in the data table, so Previous and Next step through the
 * table's rows in the table's order, across pages.
 */
export interface SubmissionListPosition {
  /** Zero-based, counted across all pages. */
  index: number
  filterQuery?: TableFilterQuery['queryObj']
  sort: SubmissionsSort
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
 * `#/forms/aBcDeF/data/table/submission/a1b2c3d4-…`.
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
 * Fetches the single neighbouring submission in either direction, among every
 * submission the user can see.
 *
 * Submissions are listed newest first (the API sorts by `{"_id":-1}`), so "next"
 * means an older record, i.e. a lower `_id`. Cursoring on `_id` rather than time
 * is what makes this possible at all: submission times are only accurate to the
 * second, so they cannot break ties. `SelectSubmission` does the same.
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

/**
 * Fetches the row before or after a record in the data table, with the table's
 * own filters and sort, so the step lands where the table would.
 *
 * Goes by offset rather than by cursor: a cursor would compare the record's own
 * values, and the API rewrites some of them on the way out (`_submission_time`,
 * `meta/rootUuid`), so they no longer match what is stored.
 */
export function getSubmissionListNeighborParams(
  position: SubmissionListPosition,
  direction: 'prev' | 'next',
): AssetsDataListParams {
  const hasFilters = position.filterQuery !== undefined && Object.keys(position.filterQuery).length > 0

  return {
    limit: 1,
    start: position.index + (direction === 'next' ? 1 : -1),
    query: hasFilters ? JSON.stringify(position.filterQuery) : undefined,
    sort: JSON.stringify(getSubmissionsSortQuery(position.sort)),
  }
}

/**
 * The "2 of 17" part of a record's heading. A capped total reads "2 of 5000+", or
 * "2 of unknown" when counting timed out.
 *
 * @param index - 1-based. Without it there is nothing to show, as the record
 * could be anywhere.
 * @param countLimit - `limited_count_max_rows` from `/environment`, where the API
 * stops counting. Needed for a capped total, which waits for it.
 */
export function getSubmissionCounterLabel(
  index: number | undefined,
  total: PaginatedDataResponseListCount | undefined,
  countLimit: number | undefined,
): string | undefined {
  if (index === undefined || total === undefined) {
    return undefined
  }

  if (total === 'unknown') {
    return `${index} ${t('of')} ${t('unknown')}`
  }

  if (total === 'many') {
    return countLimit === undefined ? undefined : `${index} ${t('of')} ${countLimit}+`
  }

  return `${index} ${t('of')} ${total}`
}
