const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'customers.json');

function ensureFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ customers: [], followers: [], nextId: 1 }, null, 2));
  }
}

function read() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function write(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

exports.init = async function () {
  ensureFile();
  console.log(`📄 儲存層: JSON 檔 (${DATA_FILE})`);
};

exports.listCustomers = async function () {
  return read().customers;
};

exports.getCustomer = async function (id) {
  return read().customers.find((c) => c.id === Number(id)) || null;
};

exports.createCustomer = async function (payload) {
  const db = read();
  const customer = {
    id: db.nextId,
    timestamp: new Date().toISOString(),
    status: 'new',
    ...payload,
  };
  db.customers.push(customer);
  db.nextId += 1;
  write(db);
  return customer;
};

exports.updateCustomer = async function (id, patch) {
  const db = read();
  const idx = db.customers.findIndex((c) => c.id === Number(id));
  if (idx === -1) return null;
  db.customers[idx] = { ...db.customers[idx], ...patch };
  write(db);
  return db.customers[idx];
};

exports.deleteCustomer = async function (id) {
  const db = read();
  const before = db.customers.length;
  db.customers = db.customers.filter((c) => c.id !== Number(id));
  if (db.customers.length === before) return false;
  write(db);
  return true;
};

exports.findCustomerByLineUserId = async function (userId) {
  return read().customers.find((c) => c.line_user_id === userId) || null;
};

exports.listFollowers = async function () {
  return read().followers || [];
};

exports.upsertFollower = async function (userId, patch = {}) {
  const db = read();
  if (!db.followers) db.followers = [];
  const existing = db.followers.find((f) => f.userId === userId);
  if (existing) {
    Object.assign(existing, patch, { lastSeen: new Date().toISOString() });
  } else {
    db.followers.push({
      userId,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      ...patch,
    });
  }
  write(db);
};

exports.removeFollower = async function (userId) {
  const db = read();
  db.followers = (db.followers || []).filter((f) => f.userId !== userId);
  write(db);
};
