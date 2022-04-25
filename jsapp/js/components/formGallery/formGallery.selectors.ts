import type {FlatQuestion} from 'jsapp/js/assetUtils';
import type {Json} from './formGallery.interfaces';

const IMAGE_MIMETYPES = [
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/svg+xml',
];

/**
 * Find a key anywhere in an object (supports nesting)
 * Based on https://stackoverflow.com/a/15524326/443457
 * @param theObject - object to search
 * @param key - key to find
 * @returns value of the found key
 */
function findByKey(theObject: Json, key: string): Json {
  let result = null;
  if (theObject instanceof Array) {
    for (let i = 0; i < theObject.length; i++) {
      result = findByKey(theObject[i], key);
      if (result) {
        break;
      }
    }
  } else if (theObject instanceof Object) {
    for (const prop in theObject) {
      if (prop == key) {
        return theObject[key];
      }
      if (
        theObject[prop] instanceof Object ||
        theObject[prop] instanceof Array
      ) {
        result = findByKey(theObject[prop], key);
        if (result) {
          break;
        }
      }
    }
  }
  return result;
}

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
        const filename = findByKey(submission, filterQuestion);
        return attachments.filter(
          (attachment) =>
            attachment.filename.split('/').slice(-1)[0] === filename
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
      if (row.type === 'begin_group') {
        groupNames.push(row.$autoname);
      } else if (row.type === 'begin_repeat') {
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
      andQuery.push({_submission_time: {$gt: startDate}});
    }
    if (endDate) {
      andQuery.push({_submission_time: {$lt: endDate}});
    }
    query['$and'] = andQuery;
  }
  return '&query=' + JSON.stringify(query);
};
