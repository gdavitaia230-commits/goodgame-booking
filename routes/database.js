const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../db/goodgame.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS stations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, number INTEGER NOT NULL, is_active INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS prices (id INTEGER PRIMARY KEY AUTOINCREMENT, station_type TEXT NOT NULL, mode TEXT NOT NULL, price_per_hour REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, booking_ref TEXT UNIQUE NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, station_type TEXT NOT NULL, station_id INTEGER, mode TEXT, start_time TEXT NOT NULL, hours INTEGER NOT NULL, total_price REAL NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT DEFAULT 'pending', stripe_session_id TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, name TEXT NOT NULL, price REAL NOT NULL, is_available INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
const sc = db.prepare('SELECT COUNT(*) as c FROM stations').get();
if (sc.c === 0) {
  const ins = db.prepare('INSERT INTO stations (name,type,number) VALUES (?,?,?)');
  for(let i=1;i<=10;i++) ins.run('VIP PC #'+i,'vip_pc',i);
  for(let i=1;i<=6;i++) ins.run('Standard PC #'+i,'standard_pc',i);
  for(let i=1;i<=4;i++) ins.run('PS5 საერთო #'+i,'ps5_shared',i);
  ins.run('PS5 VIP','ps5_vip',1);
}
const pc = db.prepare('SELECT COUNT(*) as c FROM prices').get();
if (pc.c === 0) {
  const ip = db.prepare('INSERT INTO prices (station_type,mode,price_per_hour) VALUES (?,?,?)');
  ip.run('vip_pc','1v1',3); ip.run('standard_pc','1v1',2);
  ip.run('ps5_shared','1v1',6); ip.run('ps5_shared','2x2',10);
  ip.run('ps5_vip','1v1',10); ip.run('ps5_vip','2x2',15);
}
const mc = db.prepare('SELECT COUNT(*) as c FROM menu_items').get();
if (mc.c === 0) {
  const im = db.prepare('INSERT INTO menu_items (category,name,price) VALUES (?,?,?)');
  im.run('სასმელი','წყალი',1); im.run('სასმელი','პატარა',4);
  im.run('სასმელი','Doritos დიდი',6); im.run('სასმელი','Doritos პატარა',4);
  im.run('სასმელი','მიფისთხილი',3.5); im.run('სასმელი','7DAYS კრუასანი',6);
  im.run('ალკოჰოლი','Martin Rosso',10); im.run('ალკოჰოლი','Malibu',10);
  im.run('ალკოჰოლი','Compari',10); im.run('ალკოჰოლი','Cointreau',10);
  im.run('ალკოჰოლი','Jägermeister',10);
  im.run('ლუდი','Heineken 0.5',9); im.run('ლუდი','Heineken 0.3',7); im.run('ლუდი','ქარვა 0.5',6);
  im.run('Fast Food','ტოსტი',4); im.run('Fast Food','ტოსტი ორმაგი',6);
}
const stc = db.prepare('SELECT COUNT(*) as c FROM settings').get();
if (stc.c === 0) {
  const is2 = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  is2.run('open_time','10:00'); is2.run('close_time','02:00');
  is2.run('address','134 Pushkin St, Batumi'); is2.run('phone','+995 598 32 71 27');
}
module.exports = db;