import type { Team } from './types';

export function getOtherTeam(team: Team): Team {
  return team === 'red' ? 'blue' : 'red';
}
