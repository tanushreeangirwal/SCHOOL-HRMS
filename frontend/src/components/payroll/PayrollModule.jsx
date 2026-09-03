import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Layers, 
  Calculator, 
  Calendar,
  CreditCard,
  Building2
} from 'lucide-react';
import PayrollDashboardView from './PayrollDashboardView';
import EmployeePayrollView from './EmployeePayrollView';
import SalaryStructureView from './SalaryStructureView';
import PayrollProcessingModal from './PayrollProcessingModal';
import PayslipModal from './PayslipModal';

export function PayrollModule({ 
  payrollSubTab = 'dashboard', 
  setPayrollSubTab,
  departments = [] 
}) {
  const [activeTab, setActiveTab] = useState(payrollSubTab || 'dashboard');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Synchronize activeTab when payrollSubTab prop changes (e.g. from Sidebar clicks)
  useEffect(() => {
    if (payrollSubTab) {
      setActiveTab(payrollSubTab);
    }
  }, [payrollSubTab]);

  // Modal states
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
  const [selectedPayslipId, setSelectedPayslipId] = useState(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);

  // Sync external subtab state if provided
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (setPayrollSubTab) setPayrollSubTab(tab);
  };

  const handleMonthChange = (month, year) => {
    setCurrentMonth(month);
    setCurrentYear(year);
  };

  const handleViewPayslip = (recordId) => {
    setSelectedPayslipId(recordId);
    setIsPayslipModalOpen(true);
  };

  return (
    <div className="payroll-module-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Sub-Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '2px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div className="calendar-subtabs-scrollable" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          flexWrap: 'nowrap',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          maxWidth: '100%',
          paddingBottom: '2px'
        }}>
          {/* Tab 1: Dashboard */}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handleTabChange('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            <LayoutDashboard size={15} />
            <span>Payroll Dashboard</span>
          </button>

          {/* Tab 2: Employee Register */}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'records' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handleTabChange('records')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            <FileSpreadsheet size={15} />
            <span>Employee Payroll Register</span>
          </button>

          {/* Tab 3: Salary Structures */}
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'structures' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handleTabChange('structures')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            <Layers size={15} />
            <span>Salary Structures & Rules</span>
          </button>
        </div>

        {/* Action Button: Quick Calculation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsProcessingModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Calculator size={14} />
            <span>Compute Payroll</span>
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'dashboard' && (
        <PayrollDashboardView
          currentMonth={currentMonth}
          currentYear={currentYear}
          onMonthChange={handleMonthChange}
          onOpenProcessingModal={() => setIsProcessingModalOpen(true)}
          onNavigateToRecords={() => handleTabChange('records')}
          onNavigateToStructures={() => handleTabChange('structures')}
        />
      )}

      {activeTab === 'records' && (
        <EmployeePayrollView
          currentMonth={currentMonth}
          currentYear={currentYear}
          onMonthChange={handleMonthChange}
          onViewPayslip={handleViewPayslip}
          departments={departments}
        />
      )}

      {activeTab === 'structures' && (
        <SalaryStructureView />
      )}

      {/* Modals */}
      {isProcessingModalOpen && (
        <PayrollProcessingModal
          isOpen={isProcessingModalOpen}
          onClose={() => setIsProcessingModalOpen(false)}
          onProcessed={() => {
            // Re-render occurs on close
          }}
          defaultMonth={currentMonth}
          defaultYear={currentYear}
        />
      )}

      {selectedPayslipId && isPayslipModalOpen && (
        <PayslipModal
          recordId={selectedPayslipId}
          isOpen={isPayslipModalOpen}
          onClose={() => {
            setIsPayslipModalOpen(false);
            setSelectedPayslipId(null);
          }}
        />
      )}
    </div>
  );
}

export default PayrollModule;
