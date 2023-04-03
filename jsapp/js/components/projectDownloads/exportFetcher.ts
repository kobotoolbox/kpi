import _ from 'lodash';
import {actions} from 'js/actions';
import envStore from 'js/envStore';

/**
 * Exponentially increases the returned time each time this method is being
 * called, with some randomness included. You have to handle `callCount`
 * increasing yourself.
 *
 * Returns number in milliseconds.
 *
 * Note: this function should end up in `utils.ts` or some other more generic
 * place. For now I leave it here to avoid circular dependency errors.
 */
export function getExponentialDelayTime(callCount: number) {
  // This magic number gives a nice grow for the delays.
  const magicFactor = 1.666;

  return Math.round(1000 * Math.max(
    envStore.data.min_retry_time, // Bottom limit
    Math.min(
      envStore.data.max_retry_time, // Top limit
      _.random(
        magicFactor ** callCount,
        magicFactor ** (callCount + 1)
      )
    )
  ));
}

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

  // Starts making fetch calls in a growing randomized interval.
  private makeIntervalFetchCall() {
    if (this.timeoutId > 0) {
      // Make the call if we've already waited.
      actions.exports.getExport(this.assetUid, this.exportUid);
    }

    this.callCount += 1;

    // Keep the interval alive (can't use `setInterval` with randomized value,
    // so we use `setTimout` instead).
    this.timeoutId = window.setTimeout(
      this.makeIntervalFetchCall.bind(this),
      getExponentialDelayTime(this.callCount)
    );
  }

  // Stops the instance.
  stop() {
    clearTimeout(this.timeoutId);
  }
}
