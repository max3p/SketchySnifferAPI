// In-memory TTL cache.
// Key: normalized URL
// Value: { data: <full response object>, createdAt: <timestamp> }
// Eviction: lazy (checked on read)

const TTL = 3_600_000; // 1 hour in ms

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > TTL) {
    store.delete(key);
    return undefined;
  }
  return entry.data;
}

function set(key, data) {
  store.set(key, { data, createdAt: Date.now() });
}

function has(key) {
  return get(key) !== undefined;
}

module.exports = { get, set, has };
