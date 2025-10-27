import { clsx } from 'clsx';
import { ReactNode } from 'react';

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'accent';
}

export const GradientText = ({ children, className, variant = 'primary' }: GradientTextProps) => {
  const colors = {
    primary: 'text-primary-500',
    secondary: 'text-success-500',
    accent: 'text-info-400',
  };
  
  return (
    <span
      className={clsx(
        'font-semibold',
        colors[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
