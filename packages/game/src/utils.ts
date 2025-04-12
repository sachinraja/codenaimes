import { teams, type BaseUserState, type Team } from './types';

export function getOtherTeam(team: Team): Team {
  return team === 'red' ? 'blue' : 'red';
}

export function canGameStart(users: BaseUserState[]) {
  const teamUserMap = new Map<Team, boolean>();

  for (const user of users) teamUserMap.set(user.team, true);

  return teamUserMap.size === teams.length;
}
