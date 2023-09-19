import {fetchGet} from 'js/api';
import {endpoints} from 'js/api.endpoints';
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

/**
 * A store for checing if given user exists.
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
        endpoints.USERS_USER_URL.replace('<username>', username)
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
      handleApiFail(failResult);
      return Promise.reject();
    }
  }
}

export default new UserExistenceStore();
