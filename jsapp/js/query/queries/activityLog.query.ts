import {keepPreviousData, useQuery} from '@tanstack/react-query';
import type {PaginatedResponse} from 'jsapp/js/dataInterface';
import moment from 'moment';

export interface ActivityLogItem {
  id: number;
  who: string;
  action: string;
  what: string;
  date: string;
}

// MOCK DATA GENERATION
const getRandomMockDescriptionData = () => {
  const who = ['Trent', 'Jane', 'Alice', 'Bob', 'Charlie'];
  const action = ['created', 'updated', 'deleted', 'added', 'removed'];
  const what = ['project property', 'the form', 'the permissions'];
  return {
    who: who[Math.floor(Math.random() * who.length)],
    action: action[Math.floor(Math.random() * action.length)],
    what: what[Math.floor(Math.random() * what.length)],
  };
};

const curDate = new Date();
const mockData: ActivityLogItem[] = Array.from({length: 150}, (_, index) => {
  curDate.setTime(curDate.getTime() - Math.random() * 1000000);
  return {
    id: index,
    ...getRandomMockDescriptionData(),
    date: moment(curDate).format('YYYY-MM-DD HH:mm:ss'),
  };
});
// END OF MOCK GENERATION

const getActivityLogs = async (limit: number, offset: number) =>
  new Promise<PaginatedResponse<ActivityLogItem>>((resolve) => {
    setTimeout(
      () =>
        resolve({
          next: null,
          previous: null,
          count: mockData.length,
          results: mockData.slice(offset, offset + limit),
        } as PaginatedResponse<ActivityLogItem>),
      1000
    );
  });

export const useActivityLogsQuery = (itemLimit: number, pageOffset: number) =>
  useQuery({
    queryKey: ['accessLogs', itemLimit, pageOffset],
    queryFn: () => getActivityLogs(itemLimit, pageOffset),
    placeholderData: keepPreviousData,
  });
