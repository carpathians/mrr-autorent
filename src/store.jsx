import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { api } from './api';

const StoreContext = createContext(null);

const initialState = {
  account: null,
  rigs: [],
  deals: null,
  candidates: null,
  myRigs: [],
  rentals: { owner: [], renter: [] },
  profit: null,
  workerLogs: [],
  config: {},
  workerStatus: {},
  loading: {},
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACCOUNT':
      return { ...state, account: action.payload };
    case 'SET_RIGS':
      return { ...state, rigs: action.payload };
    case 'SET_DEALS':
      return { ...state, deals: action.payload };
    case 'SET_CANDIDATES':
      return { ...state, candidates: action.payload };
    case 'SET_MY_RIGS':
      return { ...state, myRigs: action.payload };
    case 'SET_RENTALS': {
      // payload: { type: 'owner'|'renter', list: [] } or full { owner, renter }
      if (action.payload?.type && Array.isArray(action.payload.list)) {
        return {
          ...state,
          rentals: { ...state.rentals, [action.payload.type]: action.payload.list },
        };
      }
      return { ...state, rentals: action.payload };
    }
    case 'SET_PROFIT':
      return { ...state, profit: action.payload };
    case 'SET_WORKER_LOGS':
      return { ...state, workerLogs: action.payload };
    case 'SET_CONFIG':
      return { ...state, config: action.payload };
    case 'SET_WORKER_STATUS':
      return { ...state, workerStatus: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.key]: action.payload } };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function useActions() {
  const { dispatch } = useStore();

  const setLoading = useCallback((key, val) => dispatch({ type: 'SET_LOADING', key, payload: val }), [dispatch]);
  const setError = useCallback((err) => dispatch({ type: 'SET_ERROR', payload: err }), [dispatch]);
  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), [dispatch]);

  return {
    fetchAccount: useCallback(async () => {
      setLoading('account', true);
      try {
        const data = await api.getAccount();
        dispatch({ type: 'SET_ACCOUNT', payload: data?.data || data });
      } catch (e) { setError(e.message); }
      finally { setLoading('account', false); }
    }, [dispatch, setLoading, setError]),

    fetchRigs: useCallback(async (params) => {
      setLoading('rigs', true);
      try {
        const data = await api.getRigs(params);
        dispatch({ type: 'SET_RIGS', payload: data });
      } catch (e) { setError(e.message); }
      finally { setLoading('rigs', false); }
    }, [dispatch, setLoading, setError]),

    fetchDeals: useCallback(async (params) => {
      setLoading('deals', true);
      try {
        const data = await api.getDeals(params);
        dispatch({ type: 'SET_DEALS', payload: data });
      } catch (e) { setError(e.message); }
      finally { setLoading('deals', false); }
    }, [dispatch, setLoading, setError]),

    fetchCandidates: useCallback(async () => {
      setLoading('candidates', true);
      try {
        const data = await api.getCandidates();
        dispatch({ type: 'SET_CANDIDATES', payload: data?.data || data });
      } catch (e) { setError(e.message); }
      finally { setLoading('candidates', false); }
    }, [dispatch, setLoading, setError]),

    refreshCandidates: useCallback(async () => {
      setLoading('candidates', true);
      try {
        const data = await api.refreshCandidates();
        dispatch({ type: 'SET_CANDIDATES', payload: data?.data || data });
      } catch (e) { setError(e.message); }
      finally { setLoading('candidates', false); }
    }, [dispatch, setLoading, setError]),

    fetchMyRigs: useCallback(async () => {
      setLoading('myRigs', true);
      try {
        const data = await api.getMyRigs();
        dispatch({ type: 'SET_MY_RIGS', payload: data });
      } catch (e) { setError(e.message); }
      finally { setLoading('myRigs', false); }
    }, [dispatch, setLoading, setError]),

    fetchRentals: useCallback(async (params = {}) => {
      setLoading('rentals', true);
      try {
        const type = params.type || 'renter';
        const data = await api.getRentals(params);
        const list = data?.data?.rentals || data?.rentals || (Array.isArray(data?.data) ? data.data : []);
        dispatch({
          type: 'SET_RENTALS',
          payload: { type, list: Array.isArray(list) ? list : [] },
        });
      } catch (e) { setError(e.message); }
      finally { setLoading('rentals', false); }
    }, [dispatch, setLoading, setError]),

    fetchProfit: useCallback(async (params) => {
      setLoading('profit', true);
      clearError();
      try {
        const data = await api.getProfit(params);
        const summary = data?.summary || {};
        dispatch({
          type: 'SET_PROFIT',
          payload: {
            ...summary,
            summaries: data?.daily || data?.summaries || [],
          },
        });
      } catch (e) { setError(e.message); }
      finally { setLoading('profit', false); }
    }, [dispatch, setLoading, setError, clearError]),

    fetchWorkerLogs: useCallback(async (limit) => {
      setLoading('workerLogs', true);
      try {
        const data = await api.getWorkerLogs(limit);
        dispatch({ type: 'SET_WORKER_LOGS', payload: data });
      } catch (e) { setError(e.message); }
      finally { setLoading('workerLogs', false); }
    }, [dispatch, setLoading, setError]),

    fetchConfig: useCallback(async () => {
      setLoading('config', true);
      try {
        const data = await api.getConfig();
        dispatch({ type: 'SET_CONFIG', payload: data });
      } catch (e) { setError(e.message); }
      finally { setLoading('config', false); }
    }, [dispatch, setLoading, setError]),

    saveConfig: useCallback(async (data) => {
      setLoading('config', true);
      try {
        const updated = await api.updateConfig(data);
        dispatch({ type: 'SET_CONFIG', payload: updated });
      } catch (e) { setError(e.message); }
      finally { setLoading('config', false); }
    }, [dispatch, setLoading, setError]),

    fetchWorkerStatus: useCallback(async () => {
      setLoading('workerStatus', true);
      try {
        const data = await api.getWorkerStatus();
        dispatch({ type: 'SET_WORKER_STATUS', payload: data });
      } catch (e) { setError(e.message); }
      finally { setLoading('workerStatus', false); }
    }, [dispatch, setLoading, setError]),

    toggleWorker: useCallback(async (enabled) => {
      try {
        const data = await api.toggleWorker(enabled);
        dispatch({ type: 'SET_WORKER_STATUS', payload: data });
      } catch (e) { setError(e.message); }
    }, [dispatch, setError]),

    rentRig: useCallback(async (rentData) => {
      setLoading('renting', true);
      try {
        const result = await api.rentRig(rentData);
        return result;
      } catch (e) {
        setError(e.message);
        throw e;
      } finally { setLoading('renting', false); }
    }, [dispatch, setLoading, setError]),

    setLoading,
    setError,
    clearError,
  };
}
