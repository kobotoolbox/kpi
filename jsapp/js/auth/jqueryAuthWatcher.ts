import $ from 'jquery'
import { recordApiResponse } from './authChangeWatcher'

/**
 * Hands every failed jQuery request to `#/auth/authChangeWatcher`, so a session that ended underneath the page is
 * noticed on the Reflux path too - the one asset loads and the older stores still take.
 *
 * A global `ajaxError` rather than a wrapper around `$.ajax`, because `dataInterface` is not the only caller: several
 * actions and stores reach for `$.ajax` themselves, and a global event fires whatever per-call handlers they passed.
 * Requests made with `global: false` stay out, as jQuery fires nothing for those.
 *
 * Call once, during app setup.
 */
export function watchJqueryResponses(): void {
  $(document).ajaxError((_event, jqXHR, settings) => {
    // `responseJSON` is there on a failure too: jQuery converts the body "no matter what" so that the `responseXXX`
    // fields are always filled in.
    recordApiResponse({ url: settings.url ?? '', status: jqXHR.status, body: jqXHR.responseJSON })
  })
}
