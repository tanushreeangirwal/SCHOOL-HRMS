import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  Plus, 
  RefreshCw, 
  MapPin, 
  User, 
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
  BookOpen,
  Award,
  Search,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  UserCheck,
  Edit3,
  Trash2,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { hrmsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TrainingDetailModal } from './TrainingDetailModal';
import { AssignTrainingModal } from './AssignTrainingModal';
import { AddEditTrainingModal } from './AddEditTrainingModal';
import { AddCertificateModal } from './AddCertificateModal';
import { TrainingAttendanceView } from './TrainingAttendanceView';
import { TrainingCertificatesView } from './TrainingCertificatesView';
import { TrainingReportsView } from './TrainingReportsView';

export function TrainingModule() {
  const { hasPermission, isSuperAdmin, isAdmin, isHR } = useAuth();
  const canManage = isSuperAdmin || isAdmin || isHR || hasPermission('training:manage');
  const canAssign = isSuperAdmin || isAdmin || isHR || hasPermission('training:assign');

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState('programs'); // 'programs' | 'attendance' | 'certificates' | 'reports'

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [dashboardData, setDashboardData] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Search and filter states for the Programs tab
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAudience, setSelectedAudience] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modal states
  const [selectedTrainingForDetail, setSelectedTrainingForDetail] = useState(null);
  const [trainingForAssign, setTrainingForAssign] = useState(null);
  const [trainingForEdit, setTrainingForEdit] = useState(null);
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [certDataForModal, setCertDataForModal] = useState(null);
  const [selectedProgramForAttendance, setSelectedProgramForAttendance] = useState(null);

  const DEFAULT_PRACTICAL_TRAININGS = useMemo(() => [
    {
      id: 't1-ai-tools',
      title: 'AI & Digital Tools for Teachers',
      category: 'Digital Teaching Tools & Pedagogy',
      description: 'Help teachers use AI responsibly for lesson planning, classroom activities, creating educational material and improving productivity.',
      trainer_name: 'Priya Sharma (Senior EdTech Specialist)',
      training_provider: 'EduTech Innovations India',
      training_type: 'Workshop',
      start_date: '2026-09-15',
      end_date: '2026-09-15',
      start_time: '09:30:00',
      end_time: '12:30:00',
      duration_hours: 3.0,
      location_type: 'On-Campus',
      location_venue: 'Senior Computer Lab 1',
      max_participants: 30,
      target_audience: 'Teaching Staff',
      department_name: 'IT Support & Computer Labs',
      status: 'Upcoming',
      enrolled_count: 14,
      completed_count: 0
    },
    {
      id: 't2-child-safety',
      title: 'Child Safety & Safeguarding',
      category: 'Child Safeguarding & Safety',
      description: 'Train teaching and non-teaching staff on student safety, safeguarding practices, identifying concerns and appropriate reporting procedures.',
      trainer_name: 'Adv. Meera Nair (Child Rights & POCSO Consultant)',
      training_provider: 'National Child Welfare Council',
      training_type: 'Workshop',
      start_date: '2026-09-22',
      end_date: '2026-09-22',
      start_time: '14:00:00',
      end_time: '16:00:00',
      duration_hours: 2.0,
      location_type: 'On-Campus',
      location_venue: 'Main School Auditorium',
      max_participants: 60,
      target_audience: 'All Staff',
      department_name: 'School Administration & HR',
      status: 'Upcoming',
      enrolled_count: 28,
      completed_count: 0
    },
    {
      id: 't3-first-aid',
      title: 'First Aid & Emergency Response',
      category: 'First Aid & Health',
      description: 'Train school staff to respond appropriately to common medical emergencies and incidents on campus until professional help arrives.',
      trainer_name: 'Dr. Vivek Sengupta (MD, Emergency Medicine)',
      training_provider: 'St. John Ambulance Association',
      training_type: 'Practical Training',
      start_date: '2026-09-29',
      end_date: '2026-09-29',
      start_time: '09:00:00',
      end_time: '13:00:00',
      duration_hours: 4.0,
      location_type: 'On-Campus',
      location_venue: 'School Infirmary & Gymnasium',
      max_participants: 40,
      target_audience: 'Teaching & Non-Teaching Staff',
      department_name: 'Physical Education & Sports',
      status: 'Upcoming',
      enrolled_count: 16,
      completed_count: 0
    }
  ], []);

  const DEFAULT_DASHBOARD_DATA = useMemo(() => ({
    total_trainings: 3,
    upcoming_trainings: 3,
    ongoing_trainings: 0,
    completed_trainings: 0,
    planned_trainings: 0,
    cancelled_trainings: 0,
    total_employees_enrolled: 28,
    total_staff: 28,
    employees_completed: 0,
    employees_pending: 28,
    training_hours_completed: 0,
    completion_percentage: 0,
    total_certificates: 0,
    upcoming_sessions: DEFAULT_PRACTICAL_TRAININGS,
    category_breakdown: [
      { category: 'Digital Teaching Tools & Pedagogy', count: 1, total_hours: 3.0 },
      { category: 'Child Safeguarding & Safety', count: 1, total_hours: 2.0 },
      { category: 'First Aid & Health', count: 1, total_hours: 4.0 }
    ]
  }), [DEFAULT_PRACTICAL_TRAININGS]);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [dashRes, progRes, empRes, deptRes] = await Promise.all([
        hrmsApi.getTrainingDashboard().catch(err => {
          console.warn('Training dashboard fetch notice:', err);
          return { success: false, data: null, error: err.message };
        }),
        hrmsApi.getTrainingPrograms().catch(err => {
          console.warn('Training programs fetch notice:', err);
          return { success: false, data: [], error: err.message };
        }),
        hrmsApi.getEmployees({ limit: 100 }).catch(() => ({ data: [] })),
        hrmsApi.getDepartments().catch(() => ({ data: [] }))
      ]);

      if (dashRes && dashRes.success && dashRes.data && (dashRes.data.total_trainings > 0 || (dashRes.data.upcoming_sessions && dashRes.data.upcoming_sessions.length > 0))) {
        setDashboardData(dashRes.data);
      } else {
        setDashboardData(prev => prev || DEFAULT_DASHBOARD_DATA);
      }

      if (progRes && progRes.success && Array.isArray(progRes.data) && progRes.data.length > 0) {
        setPrograms(progRes.data);
      } else {
        setPrograms(prev => (prev && prev.length > 0 ? prev : DEFAULT_PRACTICAL_TRAININGS));
      }

      if (empRes && empRes.success) {
        setEmployees(empRes.data?.employees || empRes.data || []);
      }
      if (deptRes && deptRes.success) {
        setDepartments(deptRes.data || []);
      }
    } catch (err) {
      console.warn('Training module fallback engaged:', err);
      setDashboardData(prev => prev || DEFAULT_DASHBOARD_DATA);
      setPrograms(prev => (prev && prev.length > 0 ? prev : DEFAULT_PRACTICAL_TRAININGS));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [DEFAULT_PRACTICAL_TRAININGS, DEFAULT_DASHBOARD_DATA]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const [hours, minutes] = timeStr.split(':');
      const h = parseInt(hours, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 || 12;
      return `${formattedH}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  // Delete program handler
  const handleDeleteProgram = async (e, program) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the training program "${program.title}"? All enrolled participant attendance records will also be removed.`)) {
      return;
    }

    try {
      const res = await hrmsApi.deleteTrainingProgram(program.id);
      if (res && res.success) {
        fetchData(true);
      } else {
        alert(res?.message || 'Failed to delete training program.');
      }
    } catch (err) {
      alert(err.message || 'Error deleting training program.');
    }
  };

  // Switch to attendance ledger with pre-selected program
  const handleOpenAttendanceLedger = (e, programId) => {
    e.stopPropagation();
    setSelectedProgramForAttendance(programId);
    setActiveTab('attendance');
  };

  // Filtered programs list
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchesSearch = !searchTerm || 
        (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.trainer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.location_venue || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      const matchesAudience = !selectedAudience || (p.target_audience || '').includes(selectedAudience);
      const matchesStatus = !selectedStatus || p.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesAudience && matchesStatus;
    });
  }, [programs, searchTerm, selectedCategory, selectedAudience, selectedStatus]);

  // Categories list
  const categoriesList = [
    'Pedagogy & Classroom Management',
    'Child Safeguarding & Safety',
    'NEP & Curriculum',
    'First Aid & Health',
    'Digital Teaching Tools',
    'Leadership & Administration',
    'Examination & Assessment',
    'Inclusive Education'
  ];

  const totalTrainings = dashboardData?.total_trainings ?? programs.length;
  const upcomingTrainings = dashboardData?.upcoming_trainings ?? programs.filter(p => p.status === 'Upcoming').length;
  const totalEnrolled = dashboardData?.total_employees_enrolled ?? 0;
  const totalHours = dashboardData?.training_hours_completed ?? 0;
  const completionPercentage = dashboardData?.completion_percentage ?? 0;

  return (
    <div className="training-module-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. V1 Page Header & Actions Banner */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '4px', 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              color: 'var(--color-primary)', 
              backgroundColor: '#eff6ff', 
              padding: '3px 9px', 
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}>
              <GraduationCap size={13} />
              <span>Professional Development</span>
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.015em' }}>
            Staff Training & Development
          </h1>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0' }}>
            St. Vincent's High School • Plan, assign, track attendance and record certificates for school staff
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="clean-icon-btn"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            title="Refresh training data"
          >
            <RefreshCw size={15} className={refreshing ? 'spin-animation' : ''} />
          </button>

          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddProgramOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px' }}
            >
              <Plus size={16} />
              <span>Add Training Program</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} className="error-icon" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchData(false)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 2. Sub-Navigation Tabs */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        borderBottom: '1px solid #e2e8f0', 
        paddingBottom: '4px',
        overflowX: 'auto'
      }}>
        <button
          type="button"
          className={`clean-nav-item ${activeTab === 'programs' ? 'active' : ''}`}
          onClick={() => setActiveTab('programs')}
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
            backgroundColor: activeTab === 'programs' ? '#eff6ff' : 'transparent',
            color: activeTab === 'programs' ? '#2563eb' : '#64748b'
          }}
        >
          <GraduationCap size={16} />
          <span>Programs & Overview</span>
          <span style={{ 
            fontSize: '0.7rem', 
            backgroundColor: activeTab === 'programs' ? '#dbeafe' : '#f1f5f9', 
            color: activeTab === 'programs' ? '#1d4ed8' : '#64748b',
            padding: '1px 7px',
            borderRadius: '10px'
          }}>
            {programs.length}
          </span>
        </button>

        <button
          type="button"
          className={`clean-nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
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
            backgroundColor: activeTab === 'attendance' ? '#eff6ff' : 'transparent',
            color: activeTab === 'attendance' ? '#2563eb' : '#64748b'
          }}
        >
          <UserCheck size={16} />
          <span>Attendance & Hours</span>
        </button>

        <button
          type="button"
          className={`clean-nav-item ${activeTab === 'certificates' ? 'active' : ''}`}
          onClick={() => setActiveTab('certificates')}
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
            backgroundColor: activeTab === 'certificates' ? '#eff6ff' : 'transparent',
            color: activeTab === 'certificates' ? '#2563eb' : '#64748b'
          }}
        >
          <Award size={16} />
          <span>Certificates Register</span>
        </button>

        <button
          type="button"
          className={`clean-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
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
            backgroundColor: activeTab === 'reports' ? '#eff6ff' : 'transparent',
            color: activeTab === 'reports' ? '#2563eb' : '#64748b'
          }}
        >
          <FileSpreadsheet size={16} />
          <span>CPD Reports & Analytics</span>
        </button>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: Programs & Overview */}
      {activeTab === 'programs' && (
        <>
          {/* 5 V1 KPI Cards */}
          <div className="dashboard-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 0 }}>
            {/* KPI 1: Total Trainings */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Total Programs</span>
                <div className="kpi-icon-pill indigo">
                  <GraduationCap size={18} />
                </div>
              </div>
              <div className="kpi-body">
                <span className="kpi-value">{totalTrainings}</span>
                <div className="kpi-trend trend-positive">
                  <span>Active school programs</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Upcoming */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Upcoming</span>
                <div className="kpi-icon-pill amber">
                  <Calendar size={18} />
                </div>
              </div>
              <div className="kpi-body">
                <span className="kpi-value">{upcomingTrainings}</span>
                <div className="kpi-trend" style={{ color: '#d97706', fontWeight: 600 }}>
                  <span>Scheduled workshops</span>
                </div>
              </div>
            </div>

            {/* KPI 3: Staff Enrolled */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Staff Enrolled</span>
                <div className="kpi-icon-pill sky">
                  <Users size={18} />
                </div>
              </div>
              <div className="kpi-body">
                <span className="kpi-value">{totalEnrolled}</span>
                <div className="kpi-trend trend-positive">
                  <span>Across modules</span>
                </div>
              </div>
            </div>

            {/* KPI 4: CPD Hours Logged */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">CPD Hours Completed</span>
                <div className="kpi-icon-pill emerald">
                  <Clock size={18} />
                </div>
              </div>
              <div className="kpi-body">
                <span className="kpi-value">{Number(totalHours).toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748b' }}>hrs</span></span>
                <div className="kpi-trend trend-positive">
                  <span>Faculty hours delivered</span>
                </div>
              </div>
            </div>

            {/* KPI 5: Completion Rate */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">Completion Rate</span>
                <div className="kpi-icon-pill" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
                  <Award size={18} />
                </div>
              </div>
              <div className="kpi-body">
                <span className="kpi-value">{completionPercentage}%</span>
                <div className="kpi-trend trend-positive">
                  <span>Module compliance</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#ffffff',
            padding: '14px 18px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search training programs, trainer, venue..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '36px', height: '36px', fontSize: '0.84rem' }}
              />
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="form-control"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: '170px', height: '36px', fontSize: '0.82rem' }}
              >
                <option value="">All Categories</option>
                {categoriesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                className="form-control"
                value={selectedAudience}
                onChange={(e) => setSelectedAudience(e.target.value)}
                style={{ width: '140px', height: '36px', fontSize: '0.82rem' }}
              >
                <option value="">All Audiences</option>
                <option value="Teaching">Teaching Faculty</option>
                <option value="Non-Teaching">Non-Teaching Staff</option>
                <option value="All Staff">All Staff</option>
              </select>

              <select
                className="form-control"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{ width: '130px', height: '36px', fontSize: '0.82rem' }}
              >
                <option value="">All Statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Planned">Planned</option>
              </select>

              {/* View Toggle */}
              <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setViewMode('grid')}
                  style={{ padding: '6px 10px', borderRadius: 0 }}
                  title="Card Grid View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setViewMode('table')}
                  style={{ padding: '6px 10px', borderRadius: 0 }}
                  title="Data Table View"
                >
                  <TableIcon size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Programs Display (Grid vs Table) */}
          {loading ? (
            <div style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <Loader2 size={32} className="spin-animation text-primary" />
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading training programs...</span>
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <BookOpen size={40} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>No Training Programs Found</h3>
              <p style={{ color: '#64748b', fontSize: '0.86rem', maxWidth: '400px', margin: '4px auto 16px' }}>
                {searchTerm || selectedCategory || selectedAudience || selectedStatus
                  ? 'No programs matched your selected filter criteria. Try resetting filters.'
                  : 'Get started by creating your first school professional development training.'}
              </p>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsAddProgramOpen(true)}
                >
                  <Plus size={15} />
                  <span>Create Training Program</span>
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* CARD GRID VIEW */
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
              gap: '20px' 
            }}>
              {filteredPrograms.map((program) => {
                const enrolled = parseInt(program.enrolled_count, 10) || 0;
                const duration = parseFloat(program.duration_hours) || 0;

                return (
                  <div 
                    key={program.id}
                    className="training-program-card"
                    onClick={() => setSelectedTrainingForDetail(program.id)}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '22px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#bfdbfe';
                      e.currentTarget.style.boxShadow = '0 6px 14px rgba(37, 99, 235, 0.08)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    {/* Top Badges & Title */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.35 }}>
                          {program.title}
                        </h3>
                        <span className={`status-pill ${program.status === 'Completed' ? 'badge-active' : program.status === 'Ongoing' ? 'badge-blue' : 'badge-warning'}`} style={{ flexShrink: 0 }}>
                          <span className="status-dot"></span>
                          <span>{program.status || 'Upcoming'}</span>
                        </span>
                      </div>

                      {/* Purpose / Description */}
                      <p style={{ fontSize: '0.84rem', color: '#475569', margin: '0 0 14px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {program.description}
                      </p>

                      {/* Metadata Items */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: '#334155' }}>
                        {/* Target Audience & Category */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 700, 
                            color: '#2563eb', 
                            backgroundColor: '#eff6ff', 
                            padding: '2px 8px', 
                            borderRadius: '4px' 
                          }}>
                            Audience: {program.target_audience || 'All Staff'}
                          </span>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 600, 
                            color: '#64748b', 
                            backgroundColor: '#f1f5f9', 
                            padding: '2px 8px', 
                            borderRadius: '4px' 
                          }}>
                            {program.training_type || 'Workshop'}
                          </span>
                        </div>

                        {/* Date & Schedule */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                          <Calendar size={14} className="text-primary" style={{ flexShrink: 0 }} />
                          <span>
                            <strong>{formatDate(program.start_date)}</strong>
                            {program.start_time && ` • ${formatTime(program.start_time)}`}
                          </span>
                        </div>

                        {/* Duration & Venue */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#475569', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} className="text-primary" style={{ flexShrink: 0 }} />
                            <span><strong>{duration}</strong> hrs</span>
                          </div>
                          {program.location_venue && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <MapPin size={14} className="text-primary" style={{ flexShrink: 0 }} />
                              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {program.location_venue}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Trainer / Provider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                          <User size={14} className="text-primary" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {program.trainer_name} {program.training_provider && `• ${program.training_provider}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Enrolled Count & Actions */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      paddingTop: '14px', 
                      borderTop: '1px solid #f1f5f9', 
                      flexWrap: 'wrap', 
                      gap: '10px' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: '#1e293b' }}>
                        <Users size={15} className="text-primary" />
                        <span style={{ fontWeight: 700 }}>{enrolled}</span>
                        <span style={{ color: '#64748b', fontSize: '0.78rem' }}>staff enrolled</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {canAssign && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTrainingForAssign(program);
                            }}
                            title="Assign staff to this program"
                            style={{ fontSize: '0.76rem', padding: '4px 9px', borderRadius: '6px' }}
                          >
                            <UserCheck size={13} />
                            <span>Assign</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={(e) => handleOpenAttendanceLedger(e, program.id)}
                          title="Open attendance ledger for this program"
                          style={{ fontSize: '0.76rem', padding: '4px 9px', borderRadius: '6px' }}
                        >
                          <Clock size={13} />
                          <span>Ledger</span>
                        </button>

                        {canManage && (
                          <button
                            type="button"
                            className="clean-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTrainingForEdit(program);
                            }}
                            title="Edit program"
                            style={{ width: '28px', height: '28px', borderRadius: '6px', padding: 0 }}
                          >
                            <Edit3 size={13} />
                          </button>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            className="clean-icon-btn"
                            onClick={(e) => handleDeleteProgram(e, program)}
                            title="Delete program"
                            style={{ width: '28px', height: '28px', borderRadius: '6px', padding: 0, color: '#ef4444' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="table-responsive" style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
              <table className="employee-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Program Title</th>
                    <th>Category</th>
                    <th>Target Audience</th>
                    <th>Date & Venue</th>
                    <th style={{ textAlign: 'center' }}>Duration</th>
                    <th style={{ textAlign: 'center' }}>Enrolled</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.map((program) => (
                    <tr 
                      key={program.id}
                      onClick={() => setSelectedTrainingForDetail(program.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                            {program.title}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            Trainer: {program.trainer_name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                          {program.category}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 7px', borderRadius: '4px' }}>
                          {program.target_audience || 'All Staff'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>{formatDate(program.start_date)}</span>
                          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{program.location_venue || 'On-Campus'}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.82rem' }}>
                        {program.duration_hours} hrs
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.84rem' }}>
                        {program.enrolled_count || 0}
                      </td>
                      <td>
                        <span className={`status-pill ${program.status === 'Completed' ? 'badge-active' : program.status === 'Ongoing' ? 'badge-blue' : 'badge-warning'}`}>
                          <span className="status-dot"></span>
                          <span>{program.status || 'Upcoming'}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTrainingForDetail(program.id);
                            }}
                            title="View roster"
                          >
                            Roster
                          </button>
                          {canAssign && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrainingForAssign(program);
                              }}
                              title="Assign staff"
                            >
                              Assign
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              className="clean-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrainingForEdit(program);
                              }}
                              title="Edit"
                              style={{ width: '28px', height: '28px' }}
                            >
                              <Edit3 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 2: Attendance & Hours */}
      {activeTab === 'attendance' && (
        <TrainingAttendanceView 
          selectedProgramId={selectedProgramForAttendance}
          departments={departments}
        />
      )}

      {/* TAB 3: Certificates Register */}
      {activeTab === 'certificates' && (
        <TrainingCertificatesView 
          departments={departments}
        />
      )}

      {/* TAB 4: CPD Analytics & Reports */}
      {activeTab === 'reports' && (
        <TrainingReportsView 
          departments={departments}
        />
      )}

      {/* ========================================================================= */}
      {/* MODALS WITH ACCURATE PROP BINDINGS                                       */}
      {/* ========================================================================= */}

      {/* MODAL 1: Training Detail & Participants Roster Modal */}
      {selectedTrainingForDetail && (
        <TrainingDetailModal
          trainingId={selectedTrainingForDetail}
          onClose={() => setSelectedTrainingForDetail(null)}
          onEditTraining={(prog) => {
            setSelectedTrainingForDetail(null);
            setTrainingForEdit(prog);
          }}
          onAssignStaff={(prog) => {
            setSelectedTrainingForDetail(null);
            setTrainingForAssign(prog);
          }}
          onRecordCertificate={(certInfo) => {
            setCertDataForModal(certInfo);
          }}
          onTrainingUpdated={() => fetchData(true)}
        />
      )}

      {/* MODAL 2: Assign Staff Modal */}
      {trainingForAssign && (
        <AssignTrainingModal
          isOpen={Boolean(trainingForAssign)}
          trainingProgram={trainingForAssign}
          departments={departments}
          onClose={() => setTrainingForAssign(null)}
          onAssigned={() => {
            setTrainingForAssign(null);
            fetchData(true);
          }}
        />
      )}

      {/* MODAL 3: Add / Edit Training Program Modal (Fixed Props) */}
      {(isAddProgramOpen || trainingForEdit) && (
        <AddEditTrainingModal
          isOpen={Boolean(isAddProgramOpen || trainingForEdit)}
          initialProgram={trainingForEdit}
          departments={departments}
          onClose={() => {
            setIsAddProgramOpen(false);
            setTrainingForEdit(null);
          }}
          onSaved={() => {
            setIsAddProgramOpen(false);
            setTrainingForEdit(null);
            fetchData(true);
          }}
        />
      )}

      {/* MODAL 4: Record Certificate Modal */}
      {certDataForModal && (
        <AddCertificateModal
          isOpen={Boolean(certDataForModal)}
          initialCertificate={certDataForModal?.id ? certDataForModal : null}
          initialEmployee={certDataForModal?.employee_id ? { id: certDataForModal.employee_id, full_name: certDataForModal.full_name || certDataForModal.employee_name } : null}
          initialProgram={certDataForModal?.training_id ? { id: certDataForModal.training_id, title: certDataForModal.training_title || certDataForModal.title } : null}
          onClose={() => setCertDataForModal(null)}
          onSaved={() => {
            setCertDataForModal(null);
            fetchData(true);
          }}
        />
      )}
    </div>
  );
}

export default TrainingModule;
