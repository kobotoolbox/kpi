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
  /** Stores a boolean for known/checked usernames. */
  private checkedUsers: UserExistenceStoreData = {};
  private lastCheckDate: Date = new Date();

  /** Resolves with either memoized value or API call response. */
  async checkUsername(username: string): Promise<boolean> {
    // If few minutes passed since the last check, we want to wipe the memoized
    // values, since there is a chance a user might be created in the meantime
    // and we don't want to risk storing untrue `false` that will never be fixed
    // (unless user reloads the browser).
    const now = new Date();
    const diffMs = (now.valueOf() - this.lastCheckDate.valueOf());
    const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
    if (diffMins >= 3) {
      this.checkedUsers = {};
    }
    this.lastCheckDate = new Date();

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
