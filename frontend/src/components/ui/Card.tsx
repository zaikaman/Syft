import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
  onClick?: () => void;
}

export const Card = ({
  children,
  className,
  hover = false,
  gradient = false,
  onClick,
}: CardProps) => {
  const baseStyles = 'rounded-lg border transition-all duration-200';
  
  const styles = clsx(
    baseStyles,
    gradient
      ? 'bg-neutral-900 border-default'
      : 'bg-card border-default',
    hover && 'hover:bg-hover hover:border-hover cursor-pointer',
    className
  );
  
  if (onClick) {
    return (
      <motion.div
        whileHover={{ y: hover ? -2 : 0 }}
        className={styles}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }
  
  return <div className={styles}>{children}</div>;
};

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export const CardHeader = ({ children, className }: CardHeaderProps) => (
  <div className={clsx('p-4 border-b border-default', className)}>
    {children}
  </div>
);

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export const CardBody = ({ children, className }: CardBodyProps) => (
  <div className={clsx('p-4', className)}>
    {children}
  </div>
);

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export const CardFooter = ({ children, className }: CardFooterProps) => (
  <div className={clsx('p-4 border-t border-default', className)}>
    {children}
  </div>
);
