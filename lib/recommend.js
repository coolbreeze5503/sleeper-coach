const FLEX_ELIGIBLE = {
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
};

export function scoringKey(league) {
  const rec = league?.scoring_settings?.rec ?? 0;
  if (rec >= 1) return "pts_ppr";
  if (rec > 0) return "pts_half_ppr";
  return "pts_std";
}

export function buildProjectionMap(projections, key) {
  const map = new Map();
  for (const row of projections) {
    if (!row || !row.player_id) continue;
    const pts = row.stats?.[key];
    map.set(row.player_id, typeof pts === "number" ? pts : 0);
  }
  return map;
}

export function buildOwnedSet(rosters) {
  const owned = new Set();
  for (const r of rosters) {
    for (const pid of r.players || []) owned.add(pid);
  }
  return owned;
}

function slotEligible(slot, position) {
  if (slot === position) return true;
  if (FLEX_ELIGIBLE[slot]) return FLEX_ELIGIBLE[slot].includes(
