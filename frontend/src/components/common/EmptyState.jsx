import React from 'react';
import { UserX, SearchX, Plus, RefreshCw } from 'lucide-react';

export function EmptyState({ 
  isFiltered = false, 
  onAddEmployee, 
  onResetFilters 
}) {
  return (
    <div className="empty-state-card">
      <div className="empty-state-icon-wrapper">
        {isFiltered ? (
          <SearchX className="empty-state-icon" size={48} />
        ) : (
          <UserX className="empty-state-icon" size={48} />
        )}
      </div>

      <h3 className="empty-state-title">
        {isFiltered ? 'No matching staff found' : 'No staff records yet'}
      </h3>

      <p className="empty-state-description">
        {isFiltered
          ? 'No employees match your active filters or search criteria. Try adjusting your search keyword or clearing the filters.'
          : 'Your school database does not have any faculty or staff members registered yet. Get started by adding your first employee.'}
      </p>

      <div className="empty-state-actions">
        {isFiltered ? (
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onResetFilters}
          >
            <RefreshCw size={16} />
            <span>Reset Search & Filters</span>
          </button>
        ) : (
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={onAddEmployee}
          >
            <Plus size={16} />
            <span>Add First Employee</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
