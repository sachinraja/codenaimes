import { cn } from '@/lib/utils';

interface CardProps {
  children: string;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl font-medium text-white min-h-[75px]',
        className,
      )}
    >
      {children}
    </div>
  );
}
