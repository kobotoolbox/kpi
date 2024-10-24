import sessionStore from 'js/stores/session';
import {QueryKeys} from '../queryKeys';
import {useQuery} from '@tanstack/react-query';
import type {AccountResponse} from 'jsapp/js/dataInterface';

// Temporary implementation. We should replace this with a proper API call.
// once react query is fully integrated.
const getMe = (): AccountResponse =>
  sessionStore?.currentAccount as AccountResponse;

/**
 * Query to get the current user information.
 */
export const useMeQuery = () =>
  useQuery({
    queryKey: [QueryKeys.me],
    queryFn: () => getMe(),
  });
