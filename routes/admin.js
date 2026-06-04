const express = require('express');
const router = express.Router();
const db = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'goodgame_secret_2024';

function auth(req,res,next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({error:'Unauthorized'});
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({error:'Invalid token'}); }
}

router.post('/login', (req,res) => {
  const {username,password} = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) return res.status(401).json({error:'Invalid credentials'});
  const token = jwt.sign({id:admin.id,username:admin.username}, JWT_SECRET, {expiresIn:'24h'});
  res.json({token, username:admin.username});
});

router.post('/setup', (req,res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM admins').get();
  if (count.c > 0) return res.status(403).json({error:'Admin already exists'});
  const {username,password} = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admins (username,password_hash) VALUES (?,?)').run(username, hash);
  res.json({success:true});
});

router.get('/bookings', auth, (req,res) => {
  const {date,status,type} = req.query;
  let q = 'SELECT * FROM bookings WHERE 1=1'; const p = [];
  if (date) { q+=' AND date(start_time)=?'; p.push(date); }
  if (status) { q+=' AND payment_status=?'; p.push(status); }
  if (type) { q+=' AND station_type=?'; p.push(type); }
  q += ' ORDER BY start_time DESC';
  res.json(db.prepare(q).all(...p));
});

router.patch('/bookings/:id', auth, (req,res) => {
  db.prepare('UPDATE bookings SET payment_status=? WHERE id=?').run(req.body.payment_status, req.params.id);
  res.json({success:true});
});

router.delete('/bookings/:id', auth, (req,res) => {
  db.prepare("UPDATE bookings SET payment_status='cancelled' WHERE id=?").run(req.params.id);
  res.json({success:true});
});

router.get('/stats', auth, (req,res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json({
    today_bookings: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE date(start_time)=? AND payment_status!='cancelled'").get(today).c,
    today_revenue: db.prepare("SELECT COALESCE(SUM(total_price),0) as s FROM bookings WHERE date(start_time)=? AND payment_status='paid'").get(today).s,
    pending_bookings: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE payment_status='pending'").get().c,
    total_bookings: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE payment_status!='cancelled'").get().c,
    total_revenue: db.prepare("SELECT COALESCE(SUM(total_price),0) as s FROM bookings WHERE payment_status='paid'").get().s,
  });
});

router.get('/menu', auth, (req,res) => res.json(db.prepare('SELECT * FROM menu_items ORDER BY category,name').all()));
router.post('/menu', auth, (req,res) => {
  const {category,name,price} = req.body;
  const r = db.prepare('INSERT INTO menu_items (category,name,price) VALUES (?,?,?)').run(category,name,price);
  res.json({id:r.lastInsertRowid});
});
router.patch('/menu/:id', auth, (req,res) => {
  const {name,price,is_available} = req.body;
  db.prepare('UPDATE menu_items SET name=COALESCE(?,name),price=COALESCE(?,price),is_available=COALESCE(?,is_available) WHERE id=?').run(name||null,price||null,is_available!==undefined?is_available:null,req.params.id);
  res.json({success:true});
});
router.delete('/menu/:id', auth, (req,res) => {
  db.prepare('DELETE FROM menu_items WHERE id=?').run(req.params.id);
  res.json({success:true});
});

router.get('/prices', auth, (req,res) => res.json(db.prepare('SELECT * FROM prices').all()));
router.patch('/prices/:id', auth, (req,res) => {
  db.prepare('UPDATE prices SET price_per_hour=? WHERE id=?').run(req.body.price_per_hour, req.params.id);
  res.json({success:true});
});

router.get('/stations', auth, (req,res) => res.json(db.prepare('SELECT * FROM stations ORDER BY type,number').all()));
router.patch('/stations/:id', auth, (req,res) => {
  db.prepare('UPDATE stations SET is_active=? WHERE id=?').run(req.body.is_active, req.params.id);
  res.json({success:true});
});

router.get('/settings', auth, (req,res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const s = {}; rows.forEach(r => s[r.key]=r.value); res.json(s);
});
router.post('/settings', auth, (req,res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  Object.entries(req.body).forEach(([k,v]) => upsert.run(k,v));
  res.json({success:true});
});

module.exports = router;