import type { DataResponse } from '#/api/models/dataResponse'
import { SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { AssetResponse, SubmissionResponse, SubmissionResponseValue } from '#/dataInterface'
import { DISPLAY_GROUP_TYPES, DisplayGroup, getSubmissionDisplayData, stripRepeatIndices } from './submissionUtils'

/** One line of `SubmissionDataList`: a question of this submission and its response. */
export interface SubmissionDataListItem {
  /** Unique within one submission - the response's xpath, plus repeat indices and matrix row. */
  key: string
  /** The question's name, i.e. the last path segment. What `hideQuestions` is matched against. */
  name: string
  /** Localized label, or `null` when the current form has nothing naming this path. */
  label: string | null
  /** Localized labels of the groups holding this response, outermost first. */
  parents: string[]
  /** The response, `null` for a question this submission left unanswered. */
  data: SubmissionResponseValue | null
}

/**
 * The questions and responses of one submission, flattened into the list
 * `SubmissionDataList` renders.
 *
 * Built on `getSubmissionDisplayData` so that an answer stored under a path the current form
 * no longer has shows up at all. Walking the form definition, as this list used to, can only
 * ask about paths that still exist.
 */
export function getSubmissionDataListItems(
  asset: AssetResponse,
  /** For choosing the label language, see `getLanguageIndex`. */
  translationIndex: number,
  submission: DataResponse | SubmissionResponse,
): SubmissionDataListItem[] {
  const items: SubmissionDataListItem[] = []
  collectItems(getSubmissionDisplayData(asset, translationIndex, submission), [], items)
  return items
}

/** Appends one item per response found in the group, subgroups included. */
function collectItems(group: DisplayGroup, parents: string[], items: SubmissionDataListItem[], keyPrefix = '') {
  for (const child of group.children) {
    if (child instanceof DisplayGroup) {
      // A matrix repeats the same xpaths in every row, so only the row name tells its answers apart.
      const childKeyPrefix =
        child.type === DISPLAY_GROUP_TYPES.group_matrix_row && child.name ? `${keyPrefix}${child.name}/` : keyPrefix

      // A repeat group comes as one group per repetition, so its answers end up one item each.
      collectItems(child, child.label ? [...parents, child.label] : parents, items, childKeyPrefix)
      continue
    }

    // The processing view, the only place this list shows, has its own tabs for these.
    if (child.name.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
      continue
    }

    items.push({
      key: `${keyPrefix}${child.xpath}`,
      // `child.name` is the whole path for an unaccounted answer, but `hideQuestions` needs
      // the name.
      name: stripRepeatIndices(child.xpath).split('/').at(-1) ?? child.name,
      label: child.label,
      parents,
      data: child.data,
    })
  }
}
