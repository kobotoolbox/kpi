import {fetchGet} from 'js/api';
import {handleApiFail} from 'js/utils';
import type {FailResponse} from 'js/dataInterface';

export interface UserExistenceStoreData {
  [username: string]: boolean;
}

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
  private checkedUsers: UserExistenceStoreData = {};

  /** Uses memoized value or makes a call to API */
  async checkUsername(username: string) {
    if (username in this.checkedUsers) {
      return Promise.resolve(this.checkedUsers[username]);
    }

    try {
      const result = await fetchGet<UserResponse>(
        USERS_USER_ENDPOINT.replace('<username>', username),
        {notifyAboutError: false}
      );
      this.checkedUsers[result.username] = true;
      return Promise.resolve(this.checkedUsers[result.username]);
    } catch (err) {
      const failResult = err as FailResponse;
      // 404 means that call was successful, and the user doesn't exist
      if (failResult.status === 404) {
        this.checkedUsers[username] = false;
        return Promise.resolve(this.checkedUsers[username]);
      }

      // All the other responses means the call failed for some reason
      handleApiFail(failResult);
      return Promise.reject();
    }
  }
}

export default new UserExistenceStore();
