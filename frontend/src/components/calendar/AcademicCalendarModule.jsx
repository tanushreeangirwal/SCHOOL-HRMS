import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  CalendarRange, 
  Layers, 
  CalendarDays, 
  Plus, 
  RefreshCw, 
  Sparkles,
  Info
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import CalendarOverviewView from './CalendarOverviewView';
import AcademicYearsView from './AcademicYearsView';
import TermsView from './TermsView';
import HolidaysView from './HolidaysView';
import AddEditEventModal from './AddEditEventModal';

export function AcademicCalendarModule({ initialTab = 'overview' }) {
  const { user, isSuperAdmin, isAdmin, isHR, isManager, isEmployee } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR;
  const canManageYears = isSuperAdmin || isAdmin;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);
  const [isRefreshingMaster, setIsRefreshingMaster] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [addEventInitialDate, setAddEventInitialDate] = useState(null);

  // Sync initialTab if prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Fetch Master Data (Academic Years & Terms)
  const fetchMasterData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingMaster(true);
    else setIsRefreshingMaster(true);

    try {
      const [yearsRes, termsRes] = await Promise.all([
        hrmsApi.getAcademicYears(),
        hrmsApi.getAcademicTerms()
      ]);

      if (yearsRes && yearsRes.success) {
        setAcademicYears(yearsRes.data || []);
      }
      if (termsRes && termsRes.success) {
        setTerms(termsRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load calendar master data:', err);
    } finally {
      setIsLoadingMaster(false);
      setIsRefreshingMaster(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  const activeYear = academicYears.find(y => y.is_active) || academicYears[0];
  const activeYearId = activeYear?.id || null;

  return (
    <div className="academic-calendar-module-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Module Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '2px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Tab 1: Calendar Overview */}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('overview')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Calendar size={15} />
            <span>Calendar Overview</span>
          </button>

          {/* Tab 2: Holidays & Closures */}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'holidays' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('holidays')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <CalendarDays size={15} />
            <span>Holidays & Closures</span>
          </button>

          {/* Tab 3: School Terms */}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'terms' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('terms')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Layers size={15} />
            <span>School Terms</span>
          </button>

          {/* Tab 4: Academic Years (Admin / Super Admin) */}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'years' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('years')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <CalendarRange size={15} />
            <span>Academic Sessions</span>
          </button>
        </div>

        {canManage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAddEventInitialDate(null);
                setIsAddEventModalOpen(true);
              }}
            >
              <Plus size={14} />
              <span>+ Add Holiday / Event</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-Tab View Rendering */}
      <div>
        {activeTab === 'overview' && (
          <CalendarOverviewView
            onAddEvent={(dateStr) => {
              setAddEventInitialDate(dateStr);
              setIsAddEventModalOpen(true);
            }}
            onViewHolidays={() => setActiveTab('holidays')}
            onViewYears={() => setActiveTab('years')}
            onViewTerms={() => setActiveTab('terms')}
            canManage={canManage}
          />
        )}

        {activeTab === 'holidays' && (
          <HolidaysView
            academicYears={academicYears}
            terms={terms}
            activeYearId={activeYearId}
            canManage={canManage}
          />
        )}

        {activeTab === 'terms' && (
          <TermsView
            terms={terms}
            academicYears={academicYears}
            activeYearId={activeYearId}
            isLoading={isLoadingMaster}
            isRefreshing={isRefreshingMaster}
            onRefresh={() => fetchMasterData(true)}
            canManage={canManage}
          />
        )}

        {activeTab === 'years' && (
          <AcademicYearsView
            academicYears={academicYears}
            isLoading={isLoadingMaster}
            isRefreshing={isRefreshingMaster}
            onRefresh={() => fetchMasterData(true)}
            canManage={canManageYears}
          />
        )}
      </div>

      {/* Global Add Event Modal */}
      {isAddEventModalOpen && (
        <AddEditEventModal
          event={addEventInitialDate ? { start_date: addEventInitialDate, end_date: addEventInitialDate } : null}
          isOpen={isAddEventModalOpen}
          onClose={() => {
            setIsAddEventModalOpen(false);
            setAddEventInitialDate(null);
          }}
          onSaved={() => {
            fetchMasterData(true);
          }}
          academicYears={academicYears}
          terms={terms}
          activeYearId={activeYearId}
        />
      )}
    </div>
  );
}

export default AcademicCalendarModule;
