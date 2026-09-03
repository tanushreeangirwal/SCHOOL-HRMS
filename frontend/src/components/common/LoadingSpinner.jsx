import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ text = 'Loading data...', size = 24 }) {
  return (
    <div className="loading-container">
      <Loader2 className="loading-spinner" size={size} />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="table-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-bar" style={{ width: '10%' }}></div>
        <div className="skeleton-bar" style={{ width: '25%' }}></div>
        <div className="skeleton-bar" style={{ width: '15%' }}></div>
        <div className="skeleton-bar" style={{ width: '15%' }}></div>
        <div className="skeleton-bar" style={{ width: '15%' }}></div>
        <div className="skeleton-bar" style={{ width: '10%' }}></div>
        <div className="skeleton-bar" style={{ width: '10%' }}></div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="skeleton-cell" style={{ width: '80px' }}></div>
          <div className="skeleton-cell flex-cell" style={{ width: '220px' }}>
            <div className="skeleton-avatar"></div>
            <div className="skeleton-lines">
              <div className="skeleton-cell" style={{ width: '120px', height: '12px' }}></div>
              <div className="skeleton-cell" style={{ width: '160px', height: '10px' }}></div>
            </div>
          </div>
          <div className="skeleton-cell" style={{ width: '110px' }}></div>
          <div className="skeleton-cell" style={{ width: '120px' }}></div>
          <div className="skeleton-cell" style={{ width: '100px' }}></div>
          <div className="skeleton-cell" style={{ width: '90px' }}></div>
          <div className="skeleton-cell" style={{ width: '70px', height: '24px', borderRadius: '12px' }}></div>
        </div>
      ))}
    </div>
  );
}

export default LoadingSpinner;
