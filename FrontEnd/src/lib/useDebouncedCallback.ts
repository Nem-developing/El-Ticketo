import { useCallback, useEffect, useRef } from "react";

/** Retarde l'appel de `callback` jusqu'à `delayMs` ms après le dernier déclenchement. */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs = 300,
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return useCallback(
    (...args: Args) => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => callbackRef.current(...args), delayMs);
    },
    [delayMs],
  );
}
