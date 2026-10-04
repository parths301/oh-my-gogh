-- Oh my Gogh! marketplace schema (Cloudflare D1 / SQLite). Migration 0001.
-- Apply with:  npx wrangler@3 d1 migrations apply ohmygogh-marketplace --remote
-- All times are ISO-8601 UTC strings. All money is stored in minor units (cents, paise).

PRAGMA foreign_keys = ON;

CREATE TABLE artists (
  id                TEXT PRIMARY KEY,                 -- random id, e.g. "a_3k9d..."
  email             TEXT NOT NULL UNIQUE,             -- lowercased
  password_hash     TEXT NOT NULL,                    -- "pbkdf2$sha256$<iters>$<salt b64u>$<hash b64u>"
  email_verified    INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
  email_verified_at TEXT,                             -- set when email verification is built
  name              TEXT NOT NULL,
  handle            TEXT NOT NULL UNIQUE,             -- lowercase slug, public URL /artists/<handle>
  bio               TEXT NOT NULL DEFAULT '',
  location          TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',         -- free-form primary category, lowercase
  links             TEXT NOT NULL DEFAULT '[]',       -- JSON array of {label,url}, validated http(s) only
  avatar_key        TEXT,                             -- R2 key
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  status_note       TEXT NOT NULL DEFAULT '',         -- shown to the artist (reason for rejection etc.)
  terms_version     TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_artists_status ON artists (status, created_at);

CREATE TABLE artist_tags (
  artist_id TEXT NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (artist_id, tag)
);
CREATE INDEX idx_artist_tags_tag ON artist_tags (tag);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                        -- SHA-256 of the cookie value; raw token is never stored
  artist_id  TEXT NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_artist ON sessions (artist_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE products (
  id           TEXT PRIMARY KEY,                      -- short random id, lowercase base32, e.g. "k3m9x2qd7a"
  slug         TEXT NOT NULL UNIQUE,                  -- "<title-slug>-<id>"; /p/<id> and /p/<slug> both resolve
  artist_id    TEXT NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL,                         -- free-form, lowercase
  price_minor  INTEGER NOT NULL CHECK (price_minor >= 0),
  currency     TEXT NOT NULL CHECK (length(currency) = 3),
  stock        INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 0),
  edition_size INTEGER CHECK (edition_size IS NULL OR edition_size >= 1),  -- NULL = open edition / not limited
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),          -- chosen by the artist
  approval     TEXT NOT NULL DEFAULT 'pending' CHECK (approval IN ('pending','approved','rejected')), -- chosen by admin
  approval_note TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_products_artist ON products (artist_id, created_at);
CREATE INDEX idx_products_public ON products (status, approval, category, created_at);
CREATE INDEX idx_products_approval ON products (approval, created_at);

CREATE TABLE product_tags (
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  tag        TEXT NOT NULL,
  PRIMARY KEY (product_id, tag)
);
CREATE INDEX idx_product_tags_tag ON product_tags (tag);

CREATE TABLE product_images (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  r2_key       TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,                         -- sniffed from the bytes, never from the client
  bytes        INTEGER NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_product_images_product ON product_images (product_id, position);

-- Fixed-window counters used for auth and write rate limiting.
CREATE TABLE rate_limits (
  key          TEXT NOT NULL,                         -- e.g. "login:ip:<hash>"
  window_start INTEGER NOT NULL,                      -- unix seconds, start of the window
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Small audit trail of admin decisions.
CREATE TABLE admin_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL,                           -- "artist:<id>" or "product:<id>"
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
