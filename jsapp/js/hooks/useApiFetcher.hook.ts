import {useEffect, useState} from 'react';

export type WithApiFetcher<Type> = [
  Type,
  () => void,
  {pending: boolean; error: string | null; initialLoadComplete: boolean}
];

export function useApiFetcher<Type>(
  fetch: () => Promise<Type | undefined>,
  initialValue: Type
): WithApiFetcher<Type> {
  const [state, setState] = useState<Type>(initialValue);
  const [initialLoadComplete, setInitialLoad] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revalidateFlag, setRevalidateFlag] = useState(false);

  useEffect(() => {
    setPending(true);
    fetch()
      .then((data) => {
        setState(data ?? initialValue);
        if (!initialLoadComplete) {
          setInitialLoad(true);
        }
        setPending(false);
        setError(null);
      })
      .catch((reason) => {
        setState(initialValue);
        setPending(false);
        setError(reason);
      });
  }, [revalidateFlag]);

  const reload = () => {
    setRevalidateFlag(!revalidateFlag);
  };

  return [state, reload, {pending, error, initialLoadComplete}];
}

export const withApiFetcher = <Type>(
  initialState: Type
): WithApiFetcher<Type> => {
  return [
    initialState,
    () => {},
    {pending: false, error: null, initialLoadComplete: false},
  ];
};
