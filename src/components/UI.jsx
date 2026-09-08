import React from 'react';

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyle = "radius-pill font-medium px-6 py-2.5 transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-blue-700",
    secondary: "bg-surface border border-border text-ink hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    text: "bg-transparent text-ink hover:bg-gray-100",
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div className={`bg-surface radius-card shadow-sm border border-border/50 p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const Badge = ({ status, children }) => {
  const styles = {
    active: "bg-green-100 text-green-800",
    present: "bg-green-100 text-green-800",
    rest: "bg-yellow-100 text-yellow-800",
    left: "bg-red-100 text-red-800",
    absent: "bg-red-100 text-red-800",
    default: "bg-gray-100 text-gray-800"
  };
  const statusStyle = styles[status] || styles.default;
  
  return (
    <span className={`px-3 py-1 radius-pill text-xs font-medium ${statusStyle}`}>
      {children}
    </span>
  );
};

export const Input = React.forwardRef(({ className = '', ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full radius-pill border border-border px-4 py-2.5 bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${className}`}
      {...props}
    />
  );
});

export const Select = React.forwardRef(({ className = '', children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={`w-full radius-pill border border-border px-4 py-2.5 bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});

export const EmptyState = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="w-16 h-16 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
      <span className="text-gray-400 text-2xl">📋</span>
    </div>
    <h3 className="text-lg font-medium text-ink mb-2">{title}</h3>
    {description && <p className="text-ink-soft mb-6">{description}</p>}
    {action && action}
  </div>
);

export const Loading = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);
