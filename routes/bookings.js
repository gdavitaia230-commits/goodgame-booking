const express = require('express');
const router = express.Router();
const pool = require('./database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
function genRef() { return 'GG-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase(); }
router.get('/prices', async (req,res) => { const r = await pool.query('SELECT * FROM prices'); res.json(r.rows); });
router.get('/available', async (req,res) => {
  try { const {station_type} = req.query; const r = await pool.query('SELECT * FROM stations WHERE type=$1 AND is_active=1',[station_type]); res.json({available:r.rows,total:r.rows.length}); }
  catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/create', async (req,res) => {
  try {
    const {customer_name,customer_phone,station_type,station_id,mode,start_time,hours,payment_method,notes} = req.body;
    if (!customer_name||!customer_phone||!station_type||!start_time||!hours||!payment_method) return res.status(400).json({error:'Missing fields'});
    const pr = await pool.query('SELECT price_per_hour FROM prices WHERE station_type=$1 AND mode=$2',[station_type,mode||'1v1']);
    if (!pr.rows[0]) return res.status(400).json({error:'Invalid type'});
    const total = pr.rows[0].price_per_hour * parseInt(hours);
    const ref = genRef();
    const payStatus = payment_method==='cash'?'paid':'pending';
    await pool.query('INSERT INTO bookings (booking_ref,customer_name,customer_phone,station_type,station_id,mode,start_time,hours,total_price,payment_method,payment_status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[ref,customer_name,customer_phone,station_type,station_id||null,mode||'1v1',start_time,parseInt(hours),total,payment_method,payStatus,notes||'']);
    res.json({success:true,booking_ref:ref,total,payment_status:payStatus});
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/stripe-checkout', async (req,res) => {
  try {
    const {customer_name,customer_phone,station_type,station_id,mode,start_time,hours,notes} = req.body;
    const pr = await pool.query('SELECT price_per_hour FROM prices WHERE station_type=$1 AND mode=$2',[station_type,mode||'1v1']);
    if (!pr.rows[0]) return res.status(400).json({error:'Invalid type'});
    const total = pr.rows[0].price_per_hour * parseInt(hours);
    const ref = genRef();
    const labels = {vip_pc:'VIP კომპიუტერი',standard_pc:'Standard PC',ps5_shared:'PS5 საერთო',ps5_vip:'PS5 VIP'};
    const session = await stripe.checkout.sessions.create({payment_method_types:['card'],line_items:[{price_data:{currency:'gel',product_data:{name:labels[station_type]+' — '+hours+' საათი'},unit_amount:Math.round(total*100)},quantity:1}],mode:'payment',success_url:process.env.BASE_URL+'/booking-success?ref='+ref,cancel_url:process.env.BASE_URL+'/#booking'});
    await pool.query('INSERT INTO bookings (booking_ref,customer_name,customer_phone,station_type,station_id,mode,start_time,hours,total_price,payment_method,payment_status,stripe_session_id,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'card','pending',$10,$11)',[ref,customer_name,customer_phone,station_type,station_id||null,mode||'1v1',start_time,parseInt(hours),total,session.id,notes||'']);
    res.json({url:session.url,booking_ref:ref});
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.post('/webhook', express.raw({type:'application/json'}), async (req,res) => {
  try {
    const event = stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET||'');
    if (event.type==='checkout.session.completed') await pool.query("UPDATE bookings SET payment_status='paid' WHERE stripe_session_id=$1",[event.data.object.id]);
    res.json({received:true});
  } catch(e) { res.status(400).send('Webhook error: '+e.message); }
});
router.get('/ref/:ref', async (req,res) => {
  const r = await pool.query('SELECT * FROM bookings WHERE booking_ref=$1',[req.params.ref]);
  if (!r.rows[0]) return res.status(404).json({error:'Not found'});
  res.json(r.rows[0]);
});
module.exports = router;