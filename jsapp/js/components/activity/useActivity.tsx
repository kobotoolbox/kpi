import {useQuery} from '@tanstack/react-query';

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

// MOCK DATA
const curDate = new Date();
const mockData = Array.from({length: 50}, (_, index) => {
  curDate.setDate(curDate.getTime() - Math.random() * 1000000000);
  return {
    id: index,
    ...getRandomMockDescriptionData(),
    date: new Date(curDate),
  };
});

const getPaginatedData = async (limit: number, offset: number) =>
  new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          count: mockData.length,
          results: mockData.slice(offset, offset + limit),
        }),
      2000
    );
  });

export const useGetFormActivities = (limit: number, offset: number) =>
  useQuery({
    queryFn: () => getPaginatedData(limit, offset),
    queryKey: ['formActivities', limit, offset],
  });
