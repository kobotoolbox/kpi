(function(){
  const gaTokenEl = document.head.querySelector('meta[name=google-analytics-token]');
  if (gaTokenEl !== null) {
    // Code from Google below
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){dataLayer.push(arguments);};
    window.gtag('js', new Date());
    window.gtag('config', gaTokenEl);
  }
})();
