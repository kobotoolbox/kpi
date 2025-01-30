import {fetchGet} from 'js/api';
import {handleApiFail} from 'js/api';
import type {FailResponse} from 'js/dataInterface';

export interface UserResponse {
  url: string;
  username: string;
  date_joined: string;
  public_collection_subscribers_count: number;
  public_collections_count: number;
}

const USERS_USER_ENDPOINT = '/api/v2/users/<username>/';

/**
 * A store for checking if given user exists.
 */
class UserExistenceStore {
  async checkUsername(username: string): Promise<boolean> {
    try {
      await fetchGet<UserResponse>(
        USERS_USER_ENDPOINT.replace('<username>', username),
        {notifyAboutError: false}
      );
      return Promise.resolve(true);
    } catch (err) {
      const failResult = err as FailResponse;
      // 404 means that call was successful, and the user doesn't exist
      if (failResult.status === 404) {
        return Promise.resolve(false);
      }

      // All the other responses means the call failed for some reason
      handleApiFail(failResult);
      return Promise.reject();
    }
  }
}

export default new UserExistenceStore();
