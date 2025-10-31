import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  disabled,
  ...props
}: ButtonProps) => {
  const baseStyles = 'font-medium rounded-md transition-all duration-200 inline-flex items-center justify-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-dark-950 border-transparent font-semibold',
    secondary: 'bg-neutral-800 hover:bg-neutral-700 text-neutral-50 border-neutral-700',
    outline: 'bg-transparent hover:bg-neutral-900 text-neutral-50 border-default hover:border-hover',
    ghost: 'bg-transparent hover:bg-neutral-900 text-neutral-300 hover:text-neutral-50 border-transparent',
    gradient: 'bg-primary-500 hover:bg-primary-600 text-dark-950 border-transparent font-semibold',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-2.5 text-base',
    xl: 'px-6 py-3 text-lg',
  };
  
  const MotionButton = motion.button as any;
  
  return (
    <MotionButton
      whileHover={{ scale: disabled || isLoading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.99 }}
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : (
        <>
          {leftIcon && <span>{leftIcon}</span>}
          {children}
          {rightIcon && <span>{rightIcon}</span>}
        </>
      )}
    </MotionButton>
  );
};

const LoadingSpinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: 'h-3 w-12',
    md: 'h-4 w-16',
    lg: 'h-5 w-20',
  };
  
  return (
    <div className={clsx('bg-gray-300/30 rounded animate-pulse', sizes[size])} />
  );
};
