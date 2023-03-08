(function(){
  const gaTokenEl = document.head.querySelector('meta[name=google-analytics-token]');
  if (gaTokenEl !== null) {
    // Code from Google below
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', gaTokenEl);
  }
})();
