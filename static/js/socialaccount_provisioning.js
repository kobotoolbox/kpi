;(() => {
  const container = document.querySelector('.registration--provisioning')
  if (!container) return

  const isExpired = container.getAttribute('data-expired') === 'true'
  if (isExpired) return

  const pollUrl = container.getAttribute('data-poll-url')
  if (!pollUrl) return

  const pollIntervalSec = parseInt(container.getAttribute('data-poll-interval'), 10) || 10
  const pollIntervalMs = pollIntervalSec * 1000

  const timeoutSec = parseInt(container.getAttribute('data-poll-timeout'), 10) || 60
  const timeoutMs = timeoutSec * 1000

  const activeEl = document.getElementById('provisioning-active')
  const timeoutEl = document.getElementById('provisioning-timeout')

  let pollTimer = null
  let deadlineTimer = null

  function showTimeout() {
    if (pollTimer) clearInterval(pollTimer)
    if (deadlineTimer) clearTimeout(deadlineTimer)
    if (activeEl) activeEl.style.display = 'none'
    if (timeoutEl) timeoutEl.style.display = 'block'
  }

  // Browser-side deadline ensures timeout triggers even on lost connection or repeated failures
  deadlineTimer = setTimeout(showTimeout, timeoutMs)

  pollTimer = setInterval(() => {
    fetch(pollUrl, {
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        if (data.ready) {
          if (pollTimer) clearInterval(pollTimer)
          if (deadlineTimer) clearTimeout(deadlineTimer)
          window.location.href = data.redirect_url || '/'
        } else if (data.expired) {
          showTimeout()
        }
      })
      .catch((err) => {
        console.error('Provisioning poll error:', err)
      })
  }, pollIntervalMs)
})()
