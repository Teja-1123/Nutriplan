require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

const { MONGODB_URI, SESSION_SECRET, PORT = 3000, NODE_ENV } = process.env;
if (!MONGODB_URI || !SESSION_SECRET) {
  console.error('Missing MONGODB_URI or SESSION_SECRET. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
if (!process.env.SPOONACULAR_API_KEY || /^(your|dummy|change|xxx)/i.test(process.env.SPOONACULAR_API_KEY)) {
  console.warn('Heads up: SPOONACULAR_API_KEY is not set (or is a placeholder). The site will run, but live recipes will be unavailable until you add a real key to .env.');
}
const isProd = NODE_ENV === 'production';
const WEEK2 = 14 * 24 * 60 * 60;

const app = express();
if (isProd) app.set('trust proxy', 1); // needed for secure cookies behind a proxy (Render, Railway, Nginx...)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],   // recipe calls go through our own /api/recipes, so no third-party hosts are needed
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '2mb' }));

app.use(session({
  name: 'nn.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI, ttl: WEEK2 }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: WEEK2 * 1000 }
}));

// CSRF defence in depth: browsers can't send JSON cross-site without a CORS preflight, so require it on writes
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/recipes'));
app.use('/api', require('./routes/user'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
});

mongoose.connect(MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`Nourish & Nest running at http://localhost:${PORT}`)))
  .catch(err => { console.error('Could not connect to MongoDB:', err.message); process.exit(1); });
