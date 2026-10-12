CREATE TABLE devices (id TEXT PRIMARY KEY, seq INTEGER NOT NULL, subscription TEXT, prefs TEXT NOT NULL, snapshot TEXT NOT NULL, updated_at INTEGER NOT NULL, last_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE deliveries (device TEXT NOT NULL, tag TEXT NOT NULL, status TEXT NOT NULL, lease_until INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(device,tag));
CREATE INDEX deliveries_lease ON deliveries(lease_until);
