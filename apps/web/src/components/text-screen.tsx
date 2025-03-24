import type { ReactNode } from 'react';

export function TextScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-lg">
      {children}
    </div>
  );
}
