import React from 'react';
import { Search, Filter, X, RefreshCw } from 'lucide-react';

export function EmployeeFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  departmentFilter,
  setDepartmentFilter,
  departments = [],
  onResetFilters,
  totalResults,
  totalEmployees
}) {
  const isFilterActive = searchTerm.trim() !== '' || statusFilter !== 'ALL' || departmentFilter !== 'ALL';

  return (
    <div className="filters-card">
      <div className="filters-row">
        {/* Search Bar */}
        <div className="search-input-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, employee code, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="filter-select-wrapper">
          <label className="filter-label">
            <Filter size={14} />
            <span>Status:</span>
          </label>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Probation">Probation</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
          </select>
        </div>

        {/* Dynamic Department Filter */}
        <div className="filter-select-wrapper">
          <label className="filter-label">
            <span>Dept:</span>
          </label>
          <select
            className="filter-select"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Filter Button */}
        {isFilterActive && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onResetFilters}
            title="Clear all filters"
          >
            <RefreshCw size={14} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Results Subtext */}
      <div className="filters-results-info">
        <span>
          Showing <strong>{totalResults}</strong> of <strong>{totalEmployees}</strong> staff members
        </span>
        {isFilterActive && (
          <span className="filtered-indicator-badge">Filtered</span>
        )}
      </div>
    </div>
  );
}

export default EmployeeFilters;
