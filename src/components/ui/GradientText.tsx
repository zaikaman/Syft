import { clsx } from 'clsx';
import { ReactNode } from 'react';

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'accent';
}

export const GradientText = ({ children, className, variant = 'primary' }: GradientTextProps) => {
  const gradients = {
    primary: 'bg-gradient-to-r from-purple-400 to-blue-400',
    secondary: 'bg-gradient-to-r from-pink-400 to-purple-400',
    accent: 'bg-gradient-to-r from-blue-400 to-cyan-400',
  };
  
  return (
    <span
      className={clsx(
        'bg-clip-text text-transparent font-bold',
        gradients[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
