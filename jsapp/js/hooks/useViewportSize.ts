// TODO: in near future either replace with `@mantine/hooks` or other hooks library
// This is a copy of: https://github.com/mantinedev/mantine/blob/master/packages/%40mantine/hooks/src/use-viewport-size/use-viewport-size.ts
import {useCallback, useEffect, useState} from 'react';
import {useWindowEvent} from './useWindowEvent';

const eventListerOptions = {
  passive: true,
};

export function useViewportSize() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  const setSize = useCallback(() => {
    setWindowSize({ width: window.innerWidth || 0, height: window.innerHeight || 0 });
  }, []);

  useWindowEvent('resize', setSize, eventListerOptions);
  useWindowEvent('orientationchange', setSize, eventListerOptions);
  useEffect(setSize, []);

  return windowSize;
}
