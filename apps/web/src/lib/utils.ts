import type { UserState } from '@codenaimes/game/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUserClassNames(user: UserState) {
  if (user.team === 'red') {
    return 'bg-red-500/40 text-red-800';
  }

  return 'bg-blue-500/40 text-blue-800';
}
