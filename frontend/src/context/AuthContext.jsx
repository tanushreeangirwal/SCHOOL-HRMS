import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { hrmsApi, getStoredToken, setStoredToken, removeStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  // Restore authenticated session on mount
  const restoreSession = useCallback(async () => {
    const existingToken = getStoredToken();
    if (!existingToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await hrmsApi.getMe();
      if (response && response.success && response.user) {
        setUser(response.user);
        setToken(existingToken);
      } else {
        removeStoredToken();
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.warn('Session restoration failed:', err.message);
      removeStoredToken();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    // Listen for session expiration events from API interceptor
    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:session_expired', handleExpired);
    return () => {
      window.removeEventListener('auth:session_expired', handleExpired);
    };
  }, [restoreSession]);

  // Login method
  const login = async (identifier, password) => {
    const response = await hrmsApi.login(identifier, password);
    
    if (response.success) {
      if (response.require2fa) {
        // 2FA required -> Return temporary token for second factor verification
        return {
          require2fa: true,
          tempToken: response.tempToken,
          message: response.message
        };
      } else {
        // Direct login completed
        setStoredToken(response.token);
        setToken(response.token);
        setUser(response.user);
        return {
          require2fa: false,
          user: response.user
        };
      }
    } else {
      throw new Error(response.message || 'Login failed');
    }
  };

  // Complete 2FA Verification
  const verify2FA = async (tempToken, code) => {
    const response = await hrmsApi.verify2FA(tempToken, code);
    if (response.success && response.token) {
      setStoredToken(response.token);
      setToken(response.token);
      setUser(response.user);
      return response.user;
    } else {
      throw new Error(response.message || '2FA verification failed');
    }
  };

  // Logout method
  const logout = async () => {
    await hrmsApi.logout();
    removeStoredToken();
    setUser(null);
    setToken(null);
  };

  // Refresh user data (e.g., after 2FA activation)
  const refreshUser = async () => {
    try {
      const response = await hrmsApi.getMe();
      if (response && response.success) {
        setUser(response.user);
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  // Permission check helper with hierarchy support
  const hasPermission = (permissionName) => {
    if (!user) return false;
    const userRole = (user.role || '').toLowerCase().trim();
    if (userRole === 'super admin') return true;
    if (userRole === 'administrator' || userRole === 'admin') {
      if (permissionName === 'roles:manage_superadmin' || permissionName === 'system:governance') {
        return false;
      }
      return true;
    }
    const perms = user.permissions || [];
    return perms.includes(permissionName);
  };

  // Role check helper with hierarchy support
  const hasRole = (...roles) => {
    if (!user) return false;
    const normalized = roles.map(r => r.toLowerCase().trim());
    const userRole = (user.role || '').toLowerCase().trim();
    
    if (userRole === 'super admin') return true;
    if (normalized.includes(userRole)) return true;
    if ((userRole === 'administrator' || userRole === 'admin') && !normalized.includes('super admin')) {
      return true;
    }
    return false;
  };

  const userRole = (user?.role || '').toLowerCase().trim();
  const isSuperAdmin = userRole === 'super admin';
  const isAdmin = userRole === 'administrator' || userRole === 'admin';
  const isHR = userRole === 'hr';
  const isManager = userRole === 'manager';
  const isEmployee = userRole === 'employee';

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    isSuperAdmin,
    isAdmin,
    isHR,
    isManager,
    isEmployee,
    login,
    verify2FA,
    logout,
    refreshUser,
    hasPermission,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
