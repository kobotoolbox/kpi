import {useEffect, useState} from 'react';

export function useApiFetcher<Type>(
  fetch: () => Promise<Type | null>
): [Type | null, () => void] {
  const [revalidateFlag, setRevalidateFlag] = useState(false);
  const [state, setState] = useState<Type | null>(null);
  const [loaded, isLoaded] = useState(false);
  const [pending, isPending] = useState(false);

  useEffect(() => {
    fetch().then((data) => {
      setState(data);
    });
  }, [revalidateFlag]);

  const reload = () => {
    setRevalidateFlag(!revalidateFlag);
  };

  return [state, reload];
}
