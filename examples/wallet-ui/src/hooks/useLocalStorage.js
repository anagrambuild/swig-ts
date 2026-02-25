import { useCallback, useEffect, useRef, useState } from 'react';
function resolveInitializer(value) {
    return typeof value === 'function' ? value() : value;
}
function readValue(key, fallback) {
    if (typeof window === 'undefined') {
        return resolveInitializer(fallback);
    }
    try {
        const item = window.localStorage.getItem(key);
        if (item === null) {
            return resolveInitializer(fallback);
        }
        return JSON.parse(item);
    }
    catch (error) {
        console.warn(`Failed to read localStorage key "${key}":`, error);
        return resolveInitializer(fallback);
    }
}
export function useLocalStorage(key, initialValue) {
    const initRef = useRef(initialValue);
    const [value, setValue] = useState(() => readValue(key, initRef.current));
    useEffect(() => {
        setValue(readValue(key, initRef.current));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    const setStoredValue = useCallback((updater) => {
        setValue((current) => {
            const newValue = typeof updater === 'function'
                ? updater(current)
                : updater;
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem(key, JSON.stringify(newValue));
                }
                catch (error) {
                    console.warn(`Failed to write localStorage key "${key}":`, error);
                }
            }
            return newValue;
        });
    }, [key]);
    const remove = useCallback(() => {
        if (typeof window === 'undefined')
            return;
        try {
            window.localStorage.removeItem(key);
            setValue(resolveInitializer(initRef.current));
        }
        catch (error) {
            console.warn(`Failed to remove localStorage key "${key}":`, error);
        }
    }, [key]);
    return [value, setStoredValue, remove];
}
