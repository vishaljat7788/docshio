const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const SERVICE_FEE = 0.1;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const CITIES = ['Ahmedabad','Surat','Vadodara','Rajkot','Gandhinagar','Mumbai','Pune','Nashik','Delhi','Gurgaon','Noida','Jaipur','Chandigarh','Meerut','Ghaziabad','Rohtak','Bengaluru','Hyderabad','Chennai','Lucknow','Indore','Bhopal','Udaipur','Kolkata'];

/* ---------- tiny JSON database ---------- */
function seed() {
  const d = new Date(); const day = n => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const db = { users: [{ id: 'u1', name: 'Amit Patel', email: 'demo@navonavocar.in', pass: hash('demo1234'), phone: '9000000001' }],
    rides: [
      ['Ahmedabad','Surat','07:30',420,3,0],['Ahmedabad','Vadodara','09:00',180,2,0],['Mumbai','Pune','06:45',350,3,1],
      ['Gurgaon','Jaipur','08:15',450,2,1],['Delhi','Chandigarh','05:30',500,3,2],['Pune','Nashik','10:00',300,2,2],
      ['Meerut','Ghaziabad','17:00',120,3,0],['Bengaluru','Hyderabad','21:00',900,3,3]
    ].map((r, i) => ({ id: 'r' + (i + 1), driverId: 'u1', from: r[0], to: r[1], date: day(r[5]), time: r[2], price: r[3], seats: r[4], car: 'Maruti Swift (White)', note: 'AC on. One bag per seat.', instant: i % 2 === 0 })),
    bookings: [], alerts: [] };
  save(db); return db;
}
function load() { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return seed(); } }
function save(db) { fs.mkdirSync(path.dirname(DB_FILE), { recursive: true }); fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
const uid = p => p + crypto.randomBytes(5).toString('hex');

/* ---------- auth (scrypt + cookie sessions) ---------- */
function hash(pw) { const s = crypto.randomBytes(8).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); }
function verify(pw, h) { const [s, k] = h.split(':'); return crypto.timingSafeEqual(Buffer.from(k, 'hex'), crypto.scryptSync(pw, s, 32)); }
const sessions = new Map();
app.use((req, res, next) => {
  const c = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(x => x.trim().split('=')));
  req.db = load(); req.user = req.db.users.find(u => u.id === sessions.get(c.sid)) || null;
  res.locals.user = req.user; res.locals.cities = CITIES; res.locals.today = new Date().toISOString().slice(0, 10);
  res.locals.fee = SERVICE_FEE; res.locals.v = {}; res.locals.q = {}; res.locals.error = null; res.locals.path = req.path;
  next();
});
const need = (req, res, next) => req.user ? next() : res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
const withSeatsLeft = (db, r) => ({ ...r, left: r.seats - db.bookings.filter(b => b.rideId === r.id && b.status === 'confirmed').reduce((a, b) => a + b.seats, 0), driver: db.users.find(u => u.id === r.driverId) });

/* ---------- pages ---------- */
app.get('/', (req, res) => {
  const routes = [...new Map(req.db.rides.map(r => [r.from + r.to, r])).values()].slice(0, 6);
  res.render('home', { routes });
});

app.get('/search', (req, res) => {
  const { from = '', to = '', date = '', seats = 1 } = req.query;
  const has = (a, b) => !b || a.toLowerCase().includes(b.trim().toLowerCase());
  const rides = req.db.rides.map(r => withSeatsLeft(req.db, r))
    .filter(r => has(r.from, from) && has(r.to, to) && (!date || r.date === date) && r.left >= Number(seats) && r.date >= res.locals.today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.render('search', { rides, q: { from, to, date, seats } });
});

app.get('/ride/:id', (req, res) => {
  const r = req.db.rides.find(x => x.id === req.params.id); if (!r) return res.status(404).render('message', { title: 'Ride not found', text: 'This ride has been removed or does not exist.' });
  res.render('ride', { ride: withSeatsLeft(req.db, r), error: req.query.error || null });
});

app.post('/ride/:id/book', need, (req, res) => {
  const r = req.db.rides.find(x => x.id === req.params.id); if (!r) return res.redirect('/');
  const n = Math.max(1, Number(req.body.seats) || 1); const left = withSeatsLeft(req.db, r).left;
  if (r.driverId === req.user.id) return res.redirect(`/ride/${r.id}?error=You can't book your own ride`);
  if (n > left) return res.redirect(`/ride/${r.id}?error=Only ${left} seat(s) left`);
  const total = Math.round(r.price * n * (1 + SERVICE_FEE));
  req.db.bookings.push({ id: uid('b'), rideId: r.id, userId: req.user.id, seats: n, total, status: r.instant ? 'confirmed' : 'pending', createdAt: Date.now() });
  save(req.db); res.redirect('/my-rides');
});

app.post('/booking/:id/cancel', need, (req, res) => {
  const b = req.db.bookings.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (b) { b.status = 'cancelled'; save(req.db); } res.redirect('/my-rides');
});

app.post('/booking/:id/:action(accept|decline)', need, (req, res) => {
  const b = req.db.bookings.find(x => x.id === req.params.id); const r = b && req.db.rides.find(x => x.id === b.rideId);
  if (b && r && r.driverId === req.user.id) { b.status = req.params.action === 'accept' ? 'confirmed' : 'declined'; save(req.db); } res.redirect('/my-rides');
});

app.get('/offer', need, (req, res) => res.render('offer'));
app.post('/offer', need, (req, res) => {
  const { from, to, date, time, price, seats, car, note, instant } = req.body;
  if (!from || !to || from.trim().toLowerCase() === to.trim().toLowerCase() || !date || !time || !(Number(price) > 0))
    return res.render('offer', { error: 'Please fill in all fields correctly. Departure and destination must be different.', q: req.body });
  const ride = { id: uid('r'), driverId: req.user.id, from: from.trim(), to: to.trim(), date, time, price: Number(price), seats: Math.min(8, Math.max(1, Number(seats) || 1)), car: car || '', note: note || '', instant: !!instant };
  req.db.rides.push(ride);
  req.db.alerts.filter(a => a.from.toLowerCase() === ride.from.toLowerCase() && a.to.toLowerCase() === ride.to.toLowerCase())
    .forEach(a => console.log(`[ALERT] ${a.email}: new ride ${ride.from} -> ${ride.to}`));
  save(req.db); res.redirect('/ride/' + ride.id);
});

app.get('/my-rides', need, (req, res) => {
  const db = req.db;
  const booked = db.bookings.filter(b => b.userId === req.user.id).map(b => ({ ...b, ride: withSeatsLeft(db, db.rides.find(r => r.id === b.rideId)) })).reverse();
  const offered = db.rides.filter(r => r.driverId === req.user.id).map(r => ({ ...withSeatsLeft(db, r),
    requests: db.bookings.filter(b => b.rideId === r.id && b.status !== 'cancelled').map(b => ({ ...b, passenger: db.users.find(u => u.id === b.userId) })) }));
  res.render('my-rides', { booked, offered });
});

app.post('/alerts', (req, res) => {
  const { from, to, email } = req.body;
  if (from && to && /\S+@\S+\.\S+/.test(email || '')) { req.db.alerts.push({ id: uid('a'), from, to, email }); save(req.db); }
  res.render('message', { title: 'Alert created', text: `We'll email ${email} as soon as a new ride is published for ${from} → ${to}.` });
});

app.get('/register', (req, res) => res.render('auth', { mode: 'register', next: req.query.next || '/' }));
app.post('/register', (req, res) => {
  const { name, email, phone, password } = req.body; const next = req.body.next || '/';
  const bad = !name || !/\S+@\S+\.\S+/.test(email || '') || (password || '').length < 6 ? 'Enter your name, a valid email and a password of at least 6 characters.' : req.db.users.some(u => u.email === email.toLowerCase()) ? 'An account with this email already exists.' : null;
  if (bad) return res.render('auth', { mode: 'register', next, error: bad, v: req.body });
  const u = { id: uid('u'), name: name.trim(), email: email.toLowerCase(), phone: phone || '', pass: hash(password) };
  req.db.users.push(u); save(req.db); login(res, u); res.redirect(next);
});
app.get('/login', (req, res) => res.render('auth', { mode: 'login', next: req.query.next || '/' }));
app.post('/login', (req, res) => {
  const u = req.db.users.find(x => x.email === (req.body.email || '').toLowerCase()); const next = req.body.next || '/';
  if (!u || !verify(req.body.password || '', u.pass)) return res.render('auth', { mode: 'login', next, error: 'Incorrect email or password.', v: req.body });
  login(res, u); res.redirect(next);
});
app.get('/logout', (req, res) => { res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0'); res.redirect('/'); });
function login(res, u) { const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, u.id); res.setHeader('Set-Cookie', `sid=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`); }

app.use((req, res) => res.status(404).render('message', { title: '404', text: 'This page could not be found.' }));
app.listen(PORT, () => console.log(`NavoNavoCar is running at http://localhost:${PORT}`));
