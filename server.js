require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
const db = require('./routes/database');
app.get('/api/menu', (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category, name').all();
  res.json(items);
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('GoodGame port ' + PORT));