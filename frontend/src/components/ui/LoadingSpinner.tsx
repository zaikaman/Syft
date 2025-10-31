import { clsx } from 'clsx';
import { Skeleton } from './Skeleton';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const LoadingSpinner = ({ size = 'md', className }: LoadingSpinnerProps) => {
  const sizes = {
    sm: 'h-4 w-16',
    md: 'h-8 w-32',
    lg: 'h-12 w-48',
    xl: 'h-16 w-64',
  };
  
  return (
    <div className="flex items-center justify-center">
      <Skeleton className={clsx(sizes[size], className)} />
    </div>
  );
};
