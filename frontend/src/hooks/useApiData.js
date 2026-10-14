import { useCallback, useEffect, useRef, useState } from "react";

// Loads data from one or more API calls with loading / refreshing / error
// state. `loader` must return a promise; `deps` re-run it.
export default function useApiData(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const result = await loaderRef.current();
      setData(result);
      setUpdatedAt(new Date());
      return result;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load: state is only set from promise callbacks, and results that
  // arrive after unmount (or a deps change) are ignored.
  useEffect(() => {
    let cancelled = false;

    Promise.resolve()
      .then(() => loaderRef.current())
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setUpdatedAt(new Date());
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => load(true), [load]);

  return { data, setData, loading, refreshing, error, updatedAt, refresh };
}
