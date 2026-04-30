import React from 'react';

type LoadingSkeletonProps = {
  count?: number;
  className?: string;
  itemClassName?: string;
};

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 6,
  className = 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3',
  itemClassName = 'h-64 rounded-2xl',
}) => (
  <div className={className}>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className={`animate-pulse bg-gray-200/80 ${itemClassName}`} />
    ))}
  </div>
);

export default LoadingSkeleton;
