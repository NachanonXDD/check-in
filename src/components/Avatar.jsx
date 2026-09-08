import React from 'react';
import { User } from 'lucide-react';

export const Avatar = ({ src, alt, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl'
  };

  const getInitial = (name) => {
    if (!name) return '';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className={`relative rounded-full overflow-hidden flex items-center justify-center bg-blue-100 text-blue-600 font-medium shrink-0 ${sizeClasses[size]} ${className}`}>
      {src ? (
        <img src={src} alt={alt || 'Avatar'} className="w-full h-full object-cover" />
      ) : (
        alt ? <span>{getInitial(alt)}</span> : <User size={size === 'sm' ? 14 : 20} />
      )}
    </div>
  );
};
