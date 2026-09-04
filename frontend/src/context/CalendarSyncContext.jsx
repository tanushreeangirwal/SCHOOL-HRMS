import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { hrmsApi } from '../services/api';
import { useAuth } from './AuthContext';

const CalendarSyncContext = createContext(null);

export function CalendarSyncProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [calendarVersion, setCalendarVersion] = useState(1);
  const [lastChange, setLastChange] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const lastModifiedRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const eventSourceRef = useRef(null);
  const isPollingRef = useRef(false);

  // Core trigger to increment version and notify all local and cross-tab listeners
  const notifyCalendarChanged = useCallback((action = 'CHANGE', details = null) => {
    const timestamp = new Date().toISOString();
    const changePayload = { action, details, timestamp };

    setLastChange(changePayload);
    setCalendarVersion(v => v + 1);

    // 1. Dispatch custom DOM event for same-window components
    try {
      window.dispatchEvent(new CustomEvent('hrms:calendar_updated', { detail: changePayload }));
    } catch (e) {
      // safe fallback
    }

    // 2. Broadcast to other browser tabs via BroadcastChannel if supported
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(changePayload);
      } catch (e) {
        // safe fallback
      }
    }

    // 3. Fallback for cross-tab via localStorage storage event
    try {
      localStorage.setItem('hrms_calendar_sync_time', Date.now().toString());
    } catch (e) {
      // safe fallback
    }
  }, []);

  // Set up cross-tab broadcast channel
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('hrms_calendar_channel');
      broadcastChannelRef.current = channel;

      channel.onmessage = (msg) => {
        if (msg && msg.data) {
          setLastChange(msg.data);
          setCalendarVersion(v => v + 1);
        }
      };

      return () => {
        try {
          channel.close();
        } catch (e) {
          // ignore
        }
      };
    }
  }, []);

  // Listen to cross-tab storage events as fallback
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'hrms_calendar_sync_time') {
        setCalendarVersion(v => v + 1);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Polling function for cloud sync-status
  const checkServerSyncStatus = useCallback(async () => {
    if (!isAuthenticated || isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const res = await hrmsApi.getCalendarSyncStatus();
      if (res && res.success && res.last_modified) {
        if (lastModifiedRef.current && lastModifiedRef.current !== res.last_modified) {
          // Server has a newer modification than we knew
          lastModifiedRef.current = res.last_modified;
          setCalendarVersion(v => v + 1);
          setLastChange({ action: 'SERVER_SYNC', timestamp: res.last_modified });
        } else {
          lastModifiedRef.current = res.last_modified;
        }
      }
    } catch (err) {
      // Silent catch on background polling
    } finally {
      isPollingRef.current = false;
    }
  }, [isAuthenticated]);

  // Set up Server-Sent Events (SSE) stream + lightweight polling fallback
  useEffect(() => {
    if (!isAuthenticated) return;

    let sseActive = false;

    // 1. Try SSE connection for instant (< 50ms) push notifications
    try {
      const streamUrl = hrmsApi.getCalendarStreamUrl();
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsLiveConnected(true);
          sseActive = true;
        };

        es.addEventListener('calendar_change', (e) => {
          try {
            const data = JSON.parse(e.data);
            setLastChange(data);
            setCalendarVersion(v => v + 1);
          } catch (err) {
            setCalendarVersion(v => v + 1);
          }
        });

        es.onerror = () => {
          // SSE connection dropped or proxy blocked -> fallback to polling
          setIsLiveConnected(false);
          sseActive = false;
        };
      }
    } catch (e) {
      setIsLiveConnected(false);
    }

    // 2. High-reliability Polling (every 8s when window is visible)
    // Ensures updates arrive reliably on mobile and cloud environments even if SSE drops
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        checkServerSyncStatus();
      }
    }, 8000);

    // Initial check on mount
    checkServerSyncStatus();

    // Fast check on tab return / mobile device wake-up
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkServerSyncStatus();
      }
    };
    const handleWindowFocus = () => {
      checkServerSyncStatus();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [isAuthenticated, checkServerSyncStatus]);

  const value = {
    calendarVersion,
    lastChange,
    isLiveConnected,
    notifyCalendarChanged,
    refreshCalendar: () => setCalendarVersion(v => v + 1)
  };

  return (
    <CalendarSyncContext.Provider value={value}>
      {children}
    </CalendarSyncContext.Provider>
  );
}

export function useCalendarSync() {
  const context = useContext(CalendarSyncContext);
  if (!context) {
    // Graceful fallback if component is rendered outside provider
    return {
      calendarVersion: 1,
      lastChange: null,
      isLiveConnected: false,
      notifyCalendarChanged: () => {},
      refreshCalendar: () => {}
    };
  }
  return context;
}

export default CalendarSyncContext;
