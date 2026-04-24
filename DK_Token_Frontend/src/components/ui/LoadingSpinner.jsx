function LoadingSpinner({ className = 'size-8 border-4' }) {
  return <span className={`inline-block animate-spin rounded-full border-slate-200 border-t-emerald-600 ${className}`} aria-hidden="true" />;
}

export default LoadingSpinner;
