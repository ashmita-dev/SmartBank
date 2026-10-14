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
  // Every load gets a sequence number; only the newest one may update state,
  // so a slow earlier response can never overwrite a newer one.
  const seqRef = useRef(0);
  const inFlightRef = useRef(null);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const load = useCallback(async (isRefresh = false) => {
    // Repeated clicks on Refresh while a request is running reuse it instead
    // of sending another set of queries to Oracle.
    if (isRefresh && inFlightRef.current?.seq === seqRef.current) return inFlightRef.current.promise;

    const seq = ++seqRef.current;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    const run = (async () => {
      try {
        await null; // register the in-flight entry before the loader runs
        const result = await loaderRef.current();
        if (seq !== seqRef.current) return null;
        setData(result);
        setUpdatedAt(new Date());
        return result;
      } catch (err) {
        if (seq === seqRef.current) setError(err);
        return null;
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        if (inFlightRef.current?.seq === seq) inFlightRef.current = null;
      }
    })();

    inFlightRef.current = { seq, promise: run };
    return run;
  }, []);

  // Initial load: state is only set from promise callbacks, and results that
  // arrive after unmount (or a deps change) are ignored.
  useEffect(() => {
    const seq = ++seqRef.current;
    const current = () => seq === seqRef.current;
    inFlightRef.current = null;

    Promise.resolve()
      .then(() => loaderRef.current())
      .then((result) => {
        if (!current()) return;
        setData(result);
        setError(null);
        setUpdatedAt(new Date());
      })
      .catch((err) => {
        if (current()) setError(err);
      })
      .finally(() => {
        if (current()) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      // Invalidate this load on unmount or when deps change.
      seqRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => load(true), [load]);

  return { data, setData, loading, refreshing, error, updatedAt, refresh };
}
