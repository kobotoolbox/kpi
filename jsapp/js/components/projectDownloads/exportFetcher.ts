import envStore from '#/envStore'
import { getExponentialDelayTime } from '#/utils'

/**
 * Responsible for handling interval fetch calls.
 *
 * Call `stop()` this instance when completed.
 */
export default class ExportFetcher {
  private callCount = 0
  private timeoutId = -1
  private fetchExport: () => void

  constructor(fetchExport: () => void) {
    this.fetchExport = fetchExport

    // Initialize the interval.
    this.makeIntervalFetchCall()
  }

  // Starts making fetch calls in a growing randomized interval.
  private makeIntervalFetchCall() {
    if (this.timeoutId > 0) {
      // Make the call if we've already waited.
      this.fetchExport()
    }

    this.callCount += 1

    // Keep the interval alive (can't use `setInterval` with randomized value,
    // so we use `setTimout` instead).
    this.timeoutId = window.setTimeout(
      this.makeIntervalFetchCall.bind(this),
      getExponentialDelayTime(this.callCount, envStore.data.min_retry_time, envStore.data.max_retry_time),
    )
  }

  // Stops the instance.
  stop() {
    clearTimeout(this.timeoutId)
  }
}
