import { useCallback, useEffect, useRef, useState } from 'react';

type Initializer<T> = T | (() => T);
type Updater<T> = T | ((previous: T) => T);

function resolveInitializer<T>(value: Initializer<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

function readValue<T>(key: string, fallback: Initializer<T>): T {
  if (typeof window === 'undefined') {
    return resolveInitializer(fallback);
  }

  try {
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return resolveInitializer(fallback);
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to read localStorage key "${key}":`, error);
    return resolveInitializer(fallback);
  }
}

export function useLocalStorage<T>(key: string, initialValue: Initializer<T>) {
  const initRef = useRef(initialValue);
  const [value, setValue] = useState<T>(() => readValue(key, initRef.current));

  useEffect(() => {
    setValue(readValue(key, initRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStoredValue = useCallback(
    (updater: Updater<T>) => {
      setValue((current) => {
        const newValue =
          typeof updater === 'function'
            ? (updater as (prev: T) => T)(current)
            : updater;

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(newValue));
          } catch (error) {
            console.warn(`Failed to write localStorage key "${key}":`, error);
          }
        }

        return newValue;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
      setValue(resolveInitializer(initRef.current));
    } catch (error) {
      console.warn(`Failed to remove localStorage key "${key}":`, error);
    }
  }, [key]);

  return [value, setStoredValue, remove] as const;
}
