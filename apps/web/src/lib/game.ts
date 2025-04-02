import { type Team, teams, type UserState } from '@codenaimes/game/types';

export function canGameStart(users: UserState[]) {
  const teamUserMap = new Map<Team, boolean>();

  for (const user of users) {
    teamUserMap.set(user.team, true);
  }

  return (
    teamUserMap.size === teams.length &&
    teamUserMap.entries().every(([, hasPlayer]) => hasPlayer)
  );
}
