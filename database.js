// const sqlite3 = require('sqlite3').verbose();
// const path = require('path');

// const dbPath = path.resolve(__dirname, 'parking.db');

// const db = new sqlite3.Database(dbPath, (err) => {
//     if (err) {
//         console.error('Error opening database', err.message);
//     } else {
//         console.log('Connected to the SQLite database.');
//         db.run(`CREATE TABLE IF NOT EXISTS tickets (
//             id INTEGER PRIMARY KEY AUTOINCREMENT,
//             vehicle_number TEXT NOT NULL,
//             vehicle_type TEXT NOT NULL,
//             entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
//             exit_time DATETIME,
//             status TEXT DEFAULT 'PARKED',
//             fee INTEGER
//         )`);
//     }
// });

// module.exports = db;

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'parking.db');

const db = new Database(dbPath);

console.log('Connected to the SQLite database.');

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_number TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    exit_time DATETIME,
    status TEXT DEFAULT 'PARKED',
    fee INTEGER
  )
`);

module.exports = db;
