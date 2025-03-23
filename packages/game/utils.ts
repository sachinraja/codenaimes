import type { Team } from './types';

export function getOtherTeam(team: Team) {
  return team === 'red' ? 'blue' : 'red';
}
