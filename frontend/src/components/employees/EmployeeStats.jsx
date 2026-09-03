import React from 'react';
import { Users, UserCheck, Clock, UserX } from 'lucide-react';

export function EmployeeStats({ employees = [] }) {
  const total = employees.length;
  
  const activeCount = employees.filter(
    (e) => (e.employment_status || '').toLowerCase() === 'active'
  ).length;

  const probationCount = employees.filter(
    (e) => (e.employment_status || '').toLowerCase() === 'probation'
  ).length;

  const inactiveCount = employees.filter((e) => {
    const status = (e.employment_status || '').toLowerCase();
    return status === 'inactive' || status === 'terminated' || status === 'resigned';
  }).length;

  const stats = [
    {
      title: 'Total Staff',
      count: total,
      subtext: 'Registered personnel',
      icon: Users,
      colorClass: 'stat-indigo'
    },
    {
      title: 'Active Faculty & Staff',
      count: activeCount,
      subtext: `${total > 0 ? Math.round((activeCount / total) * 100) : 0}% of workforce`,
      icon: UserCheck,
      colorClass: 'stat-emerald'
    },
    {
      title: 'On Probation',
      count: probationCount,
      subtext: 'Under review period',
      icon: Clock,
      colorClass: 'stat-amber'
    },
    {
      title: 'Inactive / Archived',
      count: inactiveCount,
      subtext: 'Former or on leave',
      icon: UserX,
      colorClass: 'stat-slate'
    }
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className={`stat-card ${stat.colorClass}`}>
            <div className="stat-content">
              <span className="stat-title">{stat.title}</span>
              <div className="stat-number-wrapper">
                <span className="stat-number">{stat.count}</span>
              </div>
              <span className="stat-subtext">{stat.subtext}</span>
            </div>
            <div className="stat-icon-badge">
              <Icon size={24} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default EmployeeStats;
