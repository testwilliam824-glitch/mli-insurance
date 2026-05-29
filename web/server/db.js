// 自動切換儲存層：有 DATABASE_URL 用 Postgres，否則用 JSON 檔
module.exports = process.env.DATABASE_URL ? require('./db-pg') : require('./db-json');
