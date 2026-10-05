const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' }
});
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps login timing similar for unknown emails

const publicUser = u => ({ id: u._id, name: u.name, email: u.email, dietary: u.dietary, avatar: u.avatar, avatarColor: u.avatarColor, calorieGoal: u.calorieGoal, createdAt: u.createdAt });

// New session id on every login (prevents session fixation)
const startSession = (req, user) => new Promise((resolve, reject) => {
  req.session.regenerate(err => {
    if (err) return reject(err);
    req.session.userId = user._id.toString();
    req.session.save(e => (e ? reject(e) : resolve()));
  });
});

router.post('/register', limiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || name.length > 60) return res.status(400).json({ error: 'Please enter your name (up to 60 characters).' });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8–128 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });

    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    await startSession(req, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
    next(e);
  }
});

router.post('/login', limiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+passwordHash');
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: 'Incorrect email or password.' });
    await startSession(req, user);
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('nn.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
module.exports.publicUser = publicUser;
