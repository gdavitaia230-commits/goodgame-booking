const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stations (id SERIAL PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, number INTEGER NOT NULL, is_active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS prices (id SERIAL PRIMARY KEY, station_type TEXT NOT NULL, mode TEXT NOT NULL, price_per_hour REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY, booking_ref TEXT UNIQUE NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, station_type TEXT NOT NULL, station_id INTEGER, mode TEXT, start_time TEXT NOT NULL, hours INTEGER NOT NULL, total_price REAL NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT DEFAULT 'pending', stripe_session_id TEXT, notes TEXT, created_at TEXT DEFAULT to_char(now(),'YYYY-MM-DD HH24:MI:SS'));
    CREATE TABLE IF NOT EXISTS menu_items (id SERIAL PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL, price REAL NOT NULL, is_available INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const sc = await pool.query('SELECT COUNT(*) as c FROM stations');
  if (parseInt(sc.rows[0].c) === 0) {
    for(let i=1;i<=10;i++) await pool.query('INSERT INTO stations (name,type,number) VALUES ($1,$2,$3)',['VIP PC #'+i,'vip_pc',i]);
    for(let i=1;i<=6;i++) await pool.query('INSERT INTO stations (name,type,number) VALUES ($1,$2,$3)',['Standard PC #'+i,'standard_pc',i]);
    for(let i=1;i<=4;i++) await pool.query('INSERT INTO stations (name,type,number) VALUES ($1,$2,$3)',['PS5 Ã¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ Ã¡ÂÂÃ¡ÂÂ #'+i,'ps5_shared',i]);
    await pool.query('INSERT INTO stations (name,type,number) VALUES ($1,$2,$3)',['PS5 VIP','ps5_vip',1]);
  }
  const pc = await pool.query('SELECT COUNT(*) as c FROM prices');
  if (parseInt(pc.rows[0].c) === 0) {
    for(const r of [['vip_pc','1v1',3],['standard_pc','1v1',2],['ps5_shared','1v1',6],['ps5_shared','2x2',10],['ps5_vip','1v1',10],['ps5_vip','2x2',15]])
      await pool.query('INSERT INTO prices (station_type,mode,price_per_hour) VALUES ($1,$2,$3)',r);
  }
  const mc = await pool.query('SELECT COUNT(*) as c FROM menu_items');
  if (parseInt(mc.rows[0].c) === 0) {
    for(const i of [['Ã¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Ã¡ÂÂ¬Ã¡ÂÂ§Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ',1],['Ã¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ¢Ã¡ÂÂÃ¡ÂÂ Ã¡ÂÂ',4],['Ã¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Doritos Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ',6],['Ã¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Doritos Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ¢Ã¡ÂÂÃ¡ÂÂ Ã¡ÂÂ',4],['Ã¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ¤Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂ®Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ',3.5],['Ã¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ','7DAYS Ã¡ÂÂÃ¡ÂÂ Ã¡ÂÂ£Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ',6],['Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ°Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Martin Rosso',10],['Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ°Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Malibu',10],['Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ°Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Compari',10],['Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ°Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ','Cointreau',10],['Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ°Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂ','JÃÂ¤germeister',10],['Ã¡ÂÂÃ¡ÂÂ£Ã¡ÂÂÃ¡ÂÂ','Heineken 0.5',9],['Ã¡ÂÂÃ¡ÂÂ£Ã¡ÂÂÃ¡ÂÂ','Heineken 0.3',7],['Ã¡ÂÂÃ¡ÂÂ£Ã¡ÂÂÃ¡ÂÂ','Ã¡ÂÂ¥Ã¡ÂÂÃ¡ÂÂ Ã¡ÂÂÃ¡ÂÂ 0.5',6],['Fast Food','Ã¡ÂÂ¢Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂ¢Ã¡ÂÂ',4],['Fast Food','Ã¡ÂÂ¢Ã¡ÂÂÃ¡ÂÂ¡Ã¡ÂÂ¢Ã¡ÂÂ Ã¡ÂÂÃ¡ÂÂ Ã¡ÂÂÃ¡ÂÂÃ¡ÂÂÃ¡ÂÂ',6]])
      await pool.query('INSERT INTO menu_items (category,name,price) VALUES ($1,$2,$3)',i);
  }
  const stc = await pool.query('SELECT COUNT(*) as c FROM settings');
  if (parseInt(stc.rows[0].c) === 0)
    await pool.query("INSERT INTO settings (key,value) VALUES ('open_time','10:00'),('close_time','02:00'),('address','134 Pushkin St, Batumi'),('phone','+995 598 32 71 27')");
}
// Fix prices if wrong
pool.query("UPDATE prices SET price_per_hour=5 WHERE station_type='ps5_shared' AND mode='1v1'").catch(()=>{});
pool.query("UPDATE prices SET price_per_hour=7 WHERE station_type='ps5_shared' AND mode='2x2'").catch(()=>{});
pool.query("UPDATE prices SET price_per_hour=7 WHERE station_type='vip_pc' AND mode='1v1'").catch(()=>{});
pool.query("UPDATE prices SET price_per_hour=5 WHERE station_type='standard_pc' AND mode='1v1'").catch(()=>{});
init().catch(console.error);
module.exports = pool;