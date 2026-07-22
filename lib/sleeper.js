// Thin wrapper around Sleeper's public, read-only, key-free API.
// Docs: https://docs.sleeper.com/
// Be a good citizen: cache the big /players/nfl payload and don't
// re-fetch it more than once a day (Sleeper's own guidance).

const BASE = "https://api.slee
