import React, {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

// Send a pageview to Google Analytics for every change in routes
export const useTracking = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof gtag === 'function') {
      gtag('event', 'page_view', {page_location: window.location.hash});
    }
  }, [location]);
};

/* TODO Replace this by converting allRoutes to functional component
 *and use useTracking
 */
export const Tracking = () => {
  useTracking();
  return <></>;
};
