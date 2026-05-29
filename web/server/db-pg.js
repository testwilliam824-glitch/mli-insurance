const { Pool } = require('pg');

const useSSL =
  process.env.PGSSL === 'true' ||
  process.env.NODE_ENV === 'production' ||
  /render\.com|amazonaws\.com/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id           SERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'new',
  line_user_id TEXT,
  data         JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_customers_line ON customers(line_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

CREATE TABLE IF NOT EXISTS followers (
  user_id    TEXT PRIMARY KEY,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data       JSONB NOT NULL DEFAULT '{}'::jsonb
);
`;

const TOP_FIELDS = new Set(['id', 'timestamp', 'status', 'line_user_id']);

function rowToCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    status: row.status,
    line_user_id: row.line_user_id,
    ...(row.data || {}),
  };
}

function splitPayload(payload) {
  const top = {};
  const data = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (TOP_FIELDS.has(k)) top[k] = v;
    else data[k] = v;
  }
  return { top, data };
}

exports.init = async function () {
  await pool.query(SCHEMA);
  console.log('🐘 儲存層: PostgreSQL (已確認 schema)');
};

exports.listCustomers = async function () {
  const r = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
  return r.rows.map(rowToCustomer);
};

exports.getCustomer = async function (id) {
  const r = await pool.query('SELECT * FROM customers WHERE id = $1', [Number(id)]);
  return rowToCustomer(r.rows[0]);
};

exports.createCustomer = async function (payload) {
  const { top, data } = splitPayload(payload);
  const r = await pool.query(
    `INSERT INTO customers (status, line_user_id, data)
     VALUES (COALESCE($1, 'new'), $2, $3)
     RETURNING *`,
    [top.status || 'new', top.line_user_id || null, data]
  );
  return rowToCustomer(r.rows[0]);
};

exports.updateCustomer = async function (id, patch) {
  const existing = await exports.getCustomer(id);
  if (!existing) return null;
  const { top, data } = splitPayload(patch);
  const merged = { ...(await getRawData(id)), ...data };
  const status = top.status || existing.status;
  const lineUid = 'line_user_id' in top ? top.line_user_id : existing.line_user_id;
  const r = await pool.query(
    `UPDATE customers SET status = $1, line_user_id = $2, data = $3
     WHERE id = $4 RETURNING *`,
    [status, lineUid, merged, Number(id)]
  );
  return rowToCustomer(r.rows[0]);
};

async function getRawData(id) {
  const r = await pool.query('SELECT data FROM customers WHERE id = $1', [Number(id)]);
  return r.rows[0]?.data || {};
}

exports.deleteCustomer = async function (id) {
  const r = await pool.query('DELETE FROM customers WHERE id = $1', [Number(id)]);
  return r.rowCount > 0;
};

exports.findCustomerByLineUserId = async function (userId) {
  const r = await pool.query(
    'SELECT * FROM customers WHERE line_user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return rowToCustomer(r.rows[0]);
};

exports.listFollowers = async function () {
  const r = await pool.query('SELECT * FROM followers ORDER BY last_seen DESC');
  return r.rows.map((row) => ({
    userId: row.user_id,
    firstSeen: row.first_seen instanceof Date ? row.first_seen.toISOString() : row.first_seen,
    lastSeen: row.last_seen instanceof Date ? row.last_seen.toISOString() : row.last_seen,
    ...(row.data || {}),
  }));
};

exports.upsertFollower = async function (userId, patch = {}) {
  await pool.query(
    `INSERT INTO followers (user_id, data)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET last_seen = NOW(),
           data = followers.data || EXCLUDED.data`,
    [userId, patch]
  );
};

exports.removeFollower = async function (userId) {
  await pool.query('DELETE FROM followers WHERE user_id = $1', [userId]);
};
