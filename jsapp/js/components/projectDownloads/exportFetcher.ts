import _ from 'lodash';
import {actions} from 'js/actions';
import envStore from 'js/envStore';

/**
 * Responsible for handling interval fetch calls.
 *
 * NOTE: to use it, make sure you listen to `actions.exports.getExport` and
 * `stop()` this instance when completed.
 */
export default class ExportFetcher {
  private callCount = 0;
  private timeoutId = -1;
  private assetUid: string;
  private exportUid: string;

  constructor(assetUid: string, exportUid: string) {
    this.assetUid = assetUid;
    this.exportUid = exportUid;

    // Initialize the interval.
    this.makeIntervalFetchCall();
  }

  /**
   * Exponentially increases the delay each time this method is being called,
   * with some randomness included.
   *
   * @returns number in milliseconds
   */
  private getFetchDelay() {
    this.callCount += 1;
    // This magic number gives a nice grow for the delays.
    const magicFactor = 1.666;

    return Math.round(1000 * Math.max(
      envStore.data.min_retry_time, // Bottom limit
      Math.min(
        envStore.data.max_retry_time, // Top limit
        _.random(
          magicFactor ** this.callCount,
          magicFactor ** (this.callCount + 1)
        )
      )
    ));
  }

  // Starts making fetch calls in a growing randomized interval.
  private makeIntervalFetchCall() {
    if (this.timeoutId > 0) {
      // Make the call if we've already waited.
      actions.exports.getExport(this.assetUid, this.exportUid);
    }
    // Keep the interval alive (can't use `setInterval` with randomized value,
    // so we use `setTimout` instead).
    this.timeoutId = window.setTimeout(
      this.makeIntervalFetchCall.bind(this),
      this.getFetchDelay()
    );
  }

  // Stops the instance.
  stop() {
    clearTimeout(this.timeoutId);
  }
}
