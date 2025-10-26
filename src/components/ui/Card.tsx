import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  gradient?: boolean;
  onClick?: () => void;
}

export const Card = ({
  children,
  className,
  hover = false,
  glow = false,
  gradient = false,
  onClick,
}: CardProps) => {
  const baseStyles = 'rounded-xl backdrop-blur-md border transition-all duration-300';
  
  const styles = clsx(
    baseStyles,
    gradient
      ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30'
      : 'bg-[var(--color-bg-card)] border-[var(--border-color)]',
    hover && 'hover:bg-[var(--color-bg-hover)] hover:border-[var(--border-color-hover)] cursor-pointer hover:scale-[1.02]',
    glow && 'shadow-[0_0_30px_rgba(139,92,246,0.3)]',
    className
  );
  
  if (onClick) {
    return (
      <motion.div
        whileHover={{ y: -4 }}
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
  <div className={clsx('p-6 border-b border-white/10', className)}>
    {children}
  </div>
);

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export const CardBody = ({ children, className }: CardBodyProps) => (
  <div className={clsx('p-6', className)}>
    {children}
  </div>
);

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export const CardFooter = ({ children, className }: CardFooterProps) => (
  <div className={clsx('p-6 border-t border-white/10', className)}>
    {children}
  </div>
);
