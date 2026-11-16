/**
 * Starts Google Analytics if `base_simple.html` rendered a token. The page must
 * also load `gtag.js`.
 *
 * NOTE: Keep this file import-free. The standalone `errorApp` bundle uses it too.
 */
export function setupGoogleAnalytics() {
  const token = document.head.querySelector<HTMLMetaElement>('meta[name=google-analytics-token]')?.content
  if (!token) {
    return
  }

  window.dataLayer = window.dataLayer || []
  // biome-ignore lint/complexity/useArrowFunction: `gtag.js` needs the real `arguments` object
  window.gtag = function () {
    window.dataLayer.push(arguments)
  }
  gtag('js', new Date())
  gtag('config', token)
}
