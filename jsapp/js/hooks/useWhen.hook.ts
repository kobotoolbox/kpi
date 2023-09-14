import type {DependencyList, EffectCallback} from 'react';
import {useEffect} from 'react';
import {when} from 'mobx';

// React hook to run an effect when a mobx value changes.
// When test returns true, effect is executed.
// Any time a React value in the dependencies array gets updated, the test is re-run, just like useEffect.
const useWhen = (
  test: () => boolean,
  effect: EffectCallback,
  dependencies: DependencyList
) => {
  useEffect(() => {
    const whenPromise = when(test, effect);
    // return the disposal function so we don't cause a memory leak
    return whenPromise;
  }, dependencies);
};

/*
    const Example = () => {
      const [mfaEnabled, setMfaEnabled] = useState(false);

      useWhen(
        () => envStore.isReady,
        () => {
          setMfaEnabled(envStore.data.mfa_enabled)
        },
        []
      );

    }
 */

export default useWhen;
