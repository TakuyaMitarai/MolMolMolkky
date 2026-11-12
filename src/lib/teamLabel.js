// Display name for a team: every player's name joined with "&". A registered
// player shows their current registered name; a guest shows the name typed at
// setup. Falls back to the stored team name when there are no players.
export function teamLabel(team) {
  const names = (team?.players || []).map((p) => p.user?.name ?? p.name).filter(Boolean)
  return names.length ? names.join(' & ') : team?.name ?? ''
}
