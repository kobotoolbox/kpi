var sentryDsnEl = document.head.querySelector('meta[name=sentry-dsn]');
if (sentryDsnEl !== null) {
  Raven.config(sentryDsnEl.content).install();
}
