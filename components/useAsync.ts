// useAsync.ts - Consistent async handling hook
import { useState, useCallback } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface AsyncResult<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  data: T | null;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Custom hook for consistent async operations with loading/error states
 * 
 * Usage:
 * ```tsx
 * const { execute: fetchData, data, loading, error } = useAsync(async () => {
 *   const result = await someAsyncOperation();
 *   return result;
 * });
 * 
 * // Later
 * await fetchData();
 * ```
 */
export function useAsync<T>(
  asyncFn: (...args: unknown[]) => Promise<T>,
  initialData: T | null = null
): AsyncResult<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await asyncFn(...args);
        setData(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  return { execute, data, loading, error, reset };
}

/**
 * Simpler version that returns a boolean success indicator
 * Good for mutations (create, update, delete)
 * 
 * Usage:
 * ```tsx
 * const { execute: addPlayer, loading, error } = useAsyncAction(async (player) => {
 *   return await addPlayerToDb(player);
 * });
 * 
 * const success = await execute(newPlayer);
 * ```
 */
export function useAsyncAction<T>(
  asyncFn: (...args: unknown[]) => Promise<T>
): Omit<AsyncResult<T>, "data"> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<boolean> => {
      setLoading(true);
      setError(null);
      
      try {
        await asyncFn(...args);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { execute, loading, error, reset };
}

/**
 * Hook for async data with automatic re-fetching
 * 
 * Usage:
 * ```tsx
 * const { data, reload } = useAsyncData(() => fetchPlayers(), [dep1, dep2]);
 * ```
 */
export function useAsyncData<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = [],
  initialData: T | null = null
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFn();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useState(() => {
    fetch();
  });

  return { data, loading, error, reload: fetch };
}