// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');


// const placesLiveRouter = require('./routes/places-live');
// const translateRouter = require('./routes/translate');


// const app = express();
// const PORT = process.env.PORT || 4000;


// app.use(cors({
//   origin: '*', // or 'http://localhost:3000'
//   methods: ['GET', 'POST'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// app.use(bodyParser.json());



// const postgisRouter = require('./routes/places-postgis');
// app.use('/api/places-postgis', postgisRouter);


// // Health
// app.get('/api/health', (req, res) => res.json({ status: 'ok' }));


// // Live places
// app.use('/api/places-live', placesLiveRouter);


// // Translation
// app.use('/api/translate', translateRouter);



// app.listen(PORT, () => console.log(`Backend listening at http://localhost:${PORT}`));


require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ Routes
const placesPostGIS = require('./routes/places-postgis');
const translate = require('./routes/translate');

const placesStreamRoutes = require("./routes/places-stream");
app.use("/api/places-stream", placesStreamRoutes);


// ✅ Register endpoints
app.use('/api/places-postgis', placesPostGIS);
app.use('/api/translate', translate);

app.get('/', (req, res) => {
  res.send('🌍 Bhuvan Kannada Backend is running');
});
const pool = require('./db');

(async () => {
  try {
    const res = await pool.query(`
      SELECT current_database() AS db, current_user AS user,
             count(*) AS rows FROM places
    `);
    console.log(`✅ Connected to DB: ${res.rows[0].db}  as user: ${res.rows[0].user}`);
    console.log(`✅ Places table rows: ${res.rows[0].rows}`);
  } catch (e) {
    console.error('❌ Startup DB test failed:', e.message);
  }
})();


// ✅ Start Server
app.listen(PORT, () => {
  console.log(`✅ Backend listening at http://localhost:${PORT}`);
});
