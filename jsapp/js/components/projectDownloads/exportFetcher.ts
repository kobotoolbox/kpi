import {actions} from 'js/actions';
import envStore from 'js/envStore';
import {getExponentialDelayTime} from 'jsapp/js/utils';

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
      getExponentialDelayTime(
        this.callCount,
        envStore.data.min_retry_time,
        envStore.data.max_retry_time
      )
    );
  }

  // Stops the instance.
  stop() {
    clearTimeout(this.timeoutId);
  }
}
