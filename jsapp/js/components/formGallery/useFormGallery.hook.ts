import {usePaginatedApiFetcher} from 'js/hooks/usePaginateApiFetcher.hook';
import {
  dataInterface,
  PaginatedResponse,
  SubmissionResponse,
} from 'js/dataInterface';

const INITIAL_FORM_GALLERY_STATE: PaginatedResponse<SubmissionResponse> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export const useFormGallery = ({
  page,
  pageSize,
  asset_uid,
  sort,
  fields,
  filter,
}: Parameters<typeof dataInterface.getSubmissions>) =>
  usePaginatedApiFetcher<SubmissionResponse>({
    page,
    perPage: pageSize,
    fetcher: (...params): Parameters<typeof dataInterface.getSubmissions> => {
      return dataInterface.getSubmissions(...params);
    },
    args: [asset_uid, pageSize, page, sort, fields, filter],
    initialValue: INITIAL_FORM_GALLERY_STATE,
    options: {
      reloadEverySeconds: 15 * 60,
    },
  });
