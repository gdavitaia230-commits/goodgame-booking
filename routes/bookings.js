const express = require('express');
const router = express.Router();
const db = require('./database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

function genRef() { return 'GG-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase(); }

router.get('/prices', (req, res) => { res.json(db.prepare('SELECT * FROM prices').all()); });

router.get('/available', (req, res) => {
  const {station_type, date, start_time, hours} = req.query;
  if (!station_type||!date||!start_time||!hours) return res.status(400).json({error:'Missing params'});
  const startDT = date+' '+start_time;
  const endDT = new Date(date+'T'+start_time); endDT.setHours(endDT.getHours()+parseInt(hours));
  const endStr = endDT.toISOString().slice(0,16).replace('T',' ');
  const booked = db.prepare("SELECT station_id FROM bookings WHERE station_type=? AND payment_status!='cancelled' AND start_time<? AND datetime(start_time,'+' || hours || ' hours')>?").all(station_type,endStr,startDT).map(r=>r.station_id);
  const all = db.prepare('SELECT * FROM stations WHERE type=? AND is_active=1').all(station_type);
  res.json({available: all.filter(s=>!booked.includes(s.id)), total:all.length});
});

router.post('/create', (req, res) => {
  const {customer_name,customer_phone,station_type,station_id,mode,start_time,hours,payment_method,notes} = req.body;
  if (!customer_name||!customer_phone||!station_type||!start_time||!hours||!payment_method) return res.status(400).json({error:'Missing fields'});
  const priceRow = db.prepare('SELECT price_per_hour FROM prices WHERE station_type=? AND mode=?').get(station_type,mode||'1v1');
  if (!priceRow) return res.status(400).json({error:'Invalid type'});
  const total = priceRow.price_per_hour * parseInt(hours);
  const ref = genRef();
  const payStatus = payment_method==='cash'?'paid':'pending';
  db.prepare('INSERT INTO bookings (booking_ref,customer_name,customer_phone,station_type,station_id,mode,start_time,hours,total_price,payment_method,payment_status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(ref,customer_name,customer_phone,station_type,station_id||null,mode||'1v1',start_time,parseInt(hours),total,payment_method,payStatus,notes||'');
  res.json({success:true,booking_ref:ref,total,payment_status:payStatus});
});

router.post('/stripe-checkout', async (req, res) => {
  const {customer_name,customer_phone,station_type,station_id,mode,start_time,hours,notes} = req.body;
  const priceRow = db.prepare('SELECT price_per_hour FROM prices WHERE station_type=? AND mode=?').get(station_type,mode||'1v1');
  if (!priceRow) return res.status(400).json({error:'Invalid type'});
  const total = priceRow.price_per_hour * parseInt(hours);
  const ref = genRef();
  const labels = {vip_pc:'VIP კომპიუტერი',standard_pc:'Standard PC',ps5_shared:'PS5 საერთო',ps5_vip:'PS5 VIP'};
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      line_items:[{price_data:{currency:'gel',product_data:{name:labels[station_type]+' — '+hours+' საათი',description:start_time+' | '+(mode||'1v1')+' | '+customer_name},unit_amount:Math.round(total*100)},quantity:1}],
      mode:'payment',
      success_url: process.env.BASE_URL+'/booking-success?ref='+ref,
      cancel_url: process.env.BASE_URL+'/#booking',
      metadata:{booking_ref:ref}
    });
    db.prepare('INSERT INTO bookings (booking_ref,customer_name,customer_phone,station_type,station_id,mode,start_time,hours,total_price,payment_method,payment_status,stripe_session_id,notes) VALUES (?,?,?,?,?,?,?,?,?,'card','pending',?,?)').run(ref,customer_name,customer_phone,station_type,station_id||null,mode||'1v1',start_time,parseInt(hours),total,session.id,notes||'');
    res.json({url:session.url,booking_ref:ref});
  } catch(err) { res.status(500).json({error:err.message}); }
});

router.post('/webhook', express.raw({type:'application/json'}), (req, res) => {
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch(err) { return res.status(400).send('Webhook error: '+err.message); }
  if (event.type==='checkout.session.completed') {
    db.prepare("UPDATE bookings SET payment_status='paid' WHERE stripe_session_id=?").run(event.data.object.id);
  }
  res.json({received:true});
});

router.get('/ref/:ref', (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE booking_ref=?').get(req.params.ref);
  if (!b) return res.status(404).json({error:'Not found'});
  res.json(b);
});

module.exports = router;