import type {FlatQuestion} from 'jsapp/js/assetUtils';
import type {SubmissionResponse, SubmissionAttachment} from 'js/dataInterface';
import type {Json} from 'jsapp/js/components/common/common.interfaces';

const IMAGE_MIMETYPES = [
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/svg+xml',
];

/**
 * Data api does not return the exact file name
 * The submission shows the original filename. The attach shows it saved as done in media storage.
 * These can vary.
 */

export const selectImageAttachments = (
  submissions: SubmissionResponse[],
  filterQuestion: string | null
) =>
  ([] as SubmissionAttachment[]).concat.apply(
    [],
    submissions.map((submission) => {
      const attachments = submission._attachments.filter((attachment) =>
        IMAGE_MIMETYPES.includes(attachment.mimetype)
      );
      if (filterQuestion) {
        return attachments.filter((attachment) =>
        // Indices in the attachment xpath are for matching individual answer instances,
        // so here we stripe them out
          filterQuestion === attachment.question_xpath.replace(/\[\d*\]/g, "")
        );
      }
      return attachments;
    })
  );
export const selectShowLoadMore = (next: string | null) => !!next;
export const selectFilterQuery = (
  filterQuestion: string | null,
  flatQuestionsList: FlatQuestion[],
  startDate: string,
  endDate: string
) => {
  if (!filterQuestion && !startDate && !endDate) {
    return;
  }
  let query: Json = {};
  if (filterQuestion) {
    const flatQuestion = flatQuestionsList.find(
      (flatQuestion) => flatQuestion.path === filterQuestion
    );

    /**
     * Build query like this:
     * {
     *   "group_a/group_b": {
     *     "$elemMatch": {
     *       "group_a/group_b/group_c/group_d": {
     *         "$elemMatch": {
     *           "group_a/group_b/group_c/group_d/group_e/question": {
     *             "$exists": true
     *           }
     *         }
     *       }
     *     }
     *   }
     * }
     * There is no limit on how nested it can be due to nested repeating groups
     *
     * First separate our repeating group names (which get nested in arrays) and group names
     * (which get joined with /). This mimics the elemMatch structure we need
     */
    const repeatingGroupNames: string[] = [];
    const groupNames: string[] = [];
    flatQuestion?.parentRows.map((row) => {
      if (row.type === 'begin_group' && row.$autoname !== undefined) {
        groupNames.push(row.$autoname);
      } else if (row.type === 'begin_repeat' && row.$autoname !== undefined) {
        groupNames.push(row.$autoname);
        repeatingGroupNames.push(groupNames.join('/'));
      }
    });
    // The initialValue is the inner most part of the query where we actually filter on the question
    const initialValue: Json = {[filterQuestion]: {$exists: true}};
    // Build nested elemMatch objects, start from the inner most and build outwards
    query = repeatingGroupNames
      .reverse()
      .reduce((previousValue, currentValue) => {
        return {
          [currentValue]: {$elemMatch: previousValue},
        };
      }, initialValue);
    // Whew, thanks to initial value this works even with 0 repeating groups
  }
  if (startDate || endDate) {
    // $and is necessary as repeating a json key is not valid
    const andQuery: Json = [];
    if (startDate) {
      if (!startDate.includes('T')) {
        startDate = startDate + 'T00:00Z';
      }
      andQuery.push({_submission_time: {$gt: startDate}});
    }
    if (endDate) {
      if (!endDate.includes('T')) {
        endDate = endDate + 'T23:59:59.999Z';
      }
      andQuery.push({_submission_time: {$lt: endDate}});
    }
    query['$and'] = andQuery;
  }
  return '&query=' + JSON.stringify(query);
};
