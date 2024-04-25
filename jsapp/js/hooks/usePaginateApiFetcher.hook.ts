import {ApiFetcherArgs, useApiFetcher} from 'js/hooks/useApiFetcher.hook';
import {PaginatedResponse} from 'js/dataInterface';

interface PaginatedApiFetcherArgs<Type> extends ApiFetcherArgs<Type> {
  page: number | string;
  perPage: number | string;
}

export const usePaginatedApiFetcher = <Type>({
  ...args
}: PaginatedApiFetcherArgs<PaginatedResponse<Type>>) => {
  const [data, revalidate, status] = useApiFetcher({...args});

  return [
    data?.results,
    revalidate,
    {
      ...status,
      count: data?.count,
      // note: you shouldn't need the previous/next links, but this is useful to tell if
      // you've reached the last page (without doing calculations on the page size, count, and current page)
      next: data?.next,
    },
  ];
};
