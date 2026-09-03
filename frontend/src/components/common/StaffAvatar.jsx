import React, { useState } from 'react';

/**
 * Standard Staff Avatar Component for St. Vincent's High School HRMS
 * Renders verified profile photo or institutional initials avatar with uniform styling.
 */
export function StaffAvatar({
  name = '',
  firstName = '',
  lastName = '',
  photoUrl = '',
  size = 'md', // 'xs' (24px) | 'sm' (32px) | 'md' (38px) | 'lg' (48px) | 'xl' (64px)
  className = ''
}) {
  const [imageError, setImageError] = useState(false);

  // Extract initials cleanly
  const getInitials = () => {
    if (firstName && lastName) {
      return (firstName.trim()[0] + lastName.trim()[0]).toUpperCase();
    }
    if (firstName && !lastName) {
      return firstName.trim().slice(0, 2).toUpperCase();
    }
    if (name) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
      }
    }
    return 'EM';
  };

  const initials = getInitials();

  const sizeClasses = {
    xs: 'avatar-xs',
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
    xl: 'avatar-xl'
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  if (photoUrl && !imageError) {
    return (
      <img
        src={photoUrl}
        alt={name || `${firstName} ${lastName}` || 'Staff Member'}
        className={`staff-avatar-img ${currentSizeClass} ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={`staff-avatar-initials ${currentSizeClass} ${className}`}
      title={name || `${firstName} ${lastName}` || 'Staff Member'}
      aria-label={name || `${firstName} ${lastName}` || 'Staff Member'}
    >
      {initials}
    </div>
  );
}

export default StaffAvatar;
