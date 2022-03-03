import _ from 'lodash';
import {actions} from 'js/actions';

/**
 * Responsible for handling interval fetch calls.
 *
 * NOTE: to use it, make sure you listen to `actions.exports.getExport` and
 * `stop()` this instance when completed.
 */
export default class ExportFetcher {
  private MIN_WAIT = 4; // seconds
  private MAX_WAIT = 60 * 15; // 15 minutes (in seconds)
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

    return 1000 * Math.max(
      this.MIN_WAIT, // Bottom limit
      Math.min(
        this.MAX_WAIT, // Top limit
        Math.round(_.random(
          magicFactor ** (this.callCount + 1),
          magicFactor ** (this.callCount + 2)
        ))
      )
    );
  }

  // Starts making fetch calls in a growing randomized interval.
  private makeIntervalFetchCall() {
    // Keep the interval alive (can't use `setInterval` with randomized value,
    // so we use `setTimout` instead).
    this.timeoutId = window.setTimeout(
      this.makeIntervalFetchCall.bind(this),
      this.getFetchDelay()
    );
    // Make the call.
    actions.exports.getExport(this.assetUid, this.exportUid);
  }

  // Stops the instance.
  stop() {
    clearTimeout(this.timeoutId);
  }
}
