import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Layers, 
  Calendar as CalendarIcon, 
  UserCheck, 
  Plus,
  CalendarRange
} from 'lucide-react';
import { LeaveDashboardView } from './LeaveDashboardView';
import { LeaveRequestsView } from './LeaveRequestsView';
import { LeaveTypesView } from './LeaveTypesView';
import { LeaveCalendarView } from './LeaveCalendarView';
import { MyLeaveView } from './MyLeaveView';
import { useAuth } from '../../context/AuthContext';

export function LeaveModuleView({ initialTab = 'dashboard' }) {
  const { isSuperAdmin, isAdmin, isHR, isManager } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR || isManager;

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="leave-module-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-navigation Tabs */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        borderBottom: '1px solid #e2e8f0', 
        paddingBottom: '4px',
        overflowX: 'auto'
      }}>
        {canManage && (
          <>
            <button
              type="button"
              className={`clean-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.88rem',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'dashboard' ? '#eff6ff' : 'transparent',
                color: activeTab === 'dashboard' ? '#2563eb' : '#64748b'
              }}
            >
              <LayoutDashboard size={16} />
              <span>Leave Dashboard</span>
            </button>

            <button
              type="button"
              className={`clean-nav-item ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.88rem',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'requests' ? '#eff6ff' : 'transparent',
                color: activeTab === 'requests' ? '#2563eb' : '#64748b'
              }}
            >
              <FileText size={16} />
              <span>Leave Requests</span>
            </button>
          </>
        )}

        <button
          type="button"
          className={`clean-nav-item ${activeTab === 'my-leave' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-leave')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.88rem',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'my-leave' ? '#eff6ff' : 'transparent',
            color: activeTab === 'my-leave' ? '#2563eb' : '#64748b'
          }}
        >
          <UserCheck size={16} />
          <span>My Leave Quota</span>
        </button>

        <button
          type="button"
          className={`clean-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.88rem',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'calendar' ? '#eff6ff' : 'transparent',
            color: activeTab === 'calendar' ? '#2563eb' : '#64748b'
          }}
        >
          <CalendarIcon size={16} />
          <span>Absence Calendar</span>
        </button>

        {canManage && (
          <button
            type="button"
            className={`clean-nav-item ${activeTab === 'types' ? 'active' : ''}`}
            onClick={() => setActiveTab('types')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'types' ? '#eff6ff' : 'transparent',
              color: activeTab === 'types' ? '#2563eb' : '#64748b'
            }}
          >
            <Layers size={16} />
            <span>Leave Categories</span>
          </button>
        )}
      </div>

      {/* Render Sub-View */}
      {activeTab === 'dashboard' && canManage && (
        <LeaveDashboardView onNavigateTab={(tab) => setActiveTab(tab)} />
      )}
      {activeTab === 'requests' && canManage && (
        <LeaveRequestsView />
      )}
      {activeTab === 'my-leave' && (
        <MyLeaveView />
      )}
      {activeTab === 'calendar' && (
        <LeaveCalendarView />
      )}
      {activeTab === 'types' && canManage && (
        <LeaveTypesView />
      )}
    </div>
  );
}
