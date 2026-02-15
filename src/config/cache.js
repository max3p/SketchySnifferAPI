// In-memory TTL cache.
// Key: normalized URL
// Value: { data: <full response object>, createdAt: <timestamp> }
// Eviction: lazy (checked on read)

const TTL = 3_600_000; // 1 hour in ms

const store = new Map();

// TODO: Implement — return cached data if exists and not expired, otherwise undefined
function get(key) {}

// TODO: Implement — store data with current timestamp
function set(key, data) {}

// TODO: Implement — return true if key exists and not expired
function has(key) {}

module.exports = { get, set, has };
