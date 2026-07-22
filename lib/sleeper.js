const BASE = "https://api.sleeper.app/v1";
const PLAYERS_CACHE_KEY = "sc_players_cache_v1";
const PLAYERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Sleeper API error ${res.status} for ${url}`);
  }
  return res.json();
}

export async function getUser(usernameOrId) {
  return getJSON(`${BASE}/user/${usernameOrId}`);
}

export async function getUserLeagues(userId, season) {
  return getJSON(`${BASE}/user/${userId}/leagues/nfl/${season}`);
}

export async function getLeague(leagueId) {
  return getJSON(`${BASE}/league/${leagueId}`);
}

export async function getRosters(leagueId) {
  return getJSON(`${BASE}/league/${leagueId}/rosters`);
}

export async function getLeagueUsers(leagueId) {
  return getJSON(`${BASE}/league/${leagueId}/users`);
}

export async function getNflState() {
  return getJSON(`${BASE}/state/nfl`);
}

export async function getAllPlayers() {
  if (typeof window !== "undefined") {
    const cached = window.localStorage.getItem(PLAYERS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.fetchedAt < PLAYERS_CACHE_TTL_MS) {
          return parsed.players;
        }
      } catch (e) {}
    }
  }
  const players = await getJSON(`${BASE}/players/nfl`);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        PLAYERS_CACHE_KEY,
        JSON.stringify({ fetchedAt: Date.now(), players })
      );
    } catch (e) {}
  }
  return players;
}

export async function getWeekProjections(season, week, positions) {
  const posParams = positions.map((p) => `position[]=${p}`).join("&");
  const url = `https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular&${posParams}`;
  return getJSON(url);
}

export async function getWeekStats(season, week, positions) {
  const posParams = positions.map((p) => `position[]=${p}`).join("&");
  const url = `https://api.sleeper.app/stats/nfl/${season}/${week}?season_type=regular&${posParams}`;
  return getJSON(url);
}

export async function getTrending(type = "add", lookbackHours = 24, limit = 50) {
  return getJSON(
    `${BASE}/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`
  );
}
