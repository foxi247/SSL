/**
 * Халачи Гостиница — Node.js Backend Server (fixed)
 * - Надёжное хранение данных в data/database.json
 * - Админ-доступ по заголовку x-admin-password
 * - Загрузка изображений в public/uploads
 *
 * Start:
 *   npm install
 *   npm start
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_PATH = path.join(__dirname, 'data', 'database.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// ----------------------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');

// Static
app.use(express.static(path.join(__dirname, 'public')));

// Ensure folders
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ----------------------------------------------------------------------------
// Small JSON "DB" helpers (atomic write)
// ----------------------------------------------------------------------------
let writeLock = Promise.resolve();

async function readDb() {
  const raw = await fsp.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(nextDb) {
  // serialize writes to avoid corruption
  writeLock = writeLock.then(async () => {
    const tmp = DATA_PATH + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(nextDb, null, 2), 'utf8');
    await fsp.rename(tmp, DATA_PATH);
  });
  return writeLock;
}

function requireAdmin(req, db) {
  const pass = req.header('x-admin-password');
  if (!pass || pass !== db.hotel.admin_password) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
}

function safeNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

// ----------------------------------------------------------------------------
// Uploads
// ----------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${uuidv4()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
  res.json({ ok: true, url: `/uploads/${file.filename}` });
});

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------
app.get('/api/data', async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(db);
  } catch (e) { next(e); }
});

app.get('/api/hotel', async (req, res, next) => {
  try {
    const db = await readDb();
    const { admin_password, ...hotelPublic } = db.hotel;
    res.json(hotelPublic);
  } catch (e) { next(e); }
});

app.get('/api/rooms', async (req, res, next) => {
  try {
    const db = await readDb();
    const rooms = [...(db.rooms || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    res.json(rooms);
  } catch (e) { next(e); }
});

app.get('/api/tours', async (req, res, next) => {
  try {
    const db = await readDb();
    const tours = [...(db.tours || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    res.json(tours);
  } catch (e) { next(e); }
});

app.post('/api/booking', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const name = String(payload.name || '').trim();
    const phone = String(payload.phone || '').trim();
    if (!name || !phone) return res.status(400).json({ ok: false, error: 'name and phone are required' });

    const db = await readDb();

    const booking = {
      id: uuidv4(),
      name,
      phone,
      email: String(payload.email || '').trim(),
      room_type: String(payload.room_type || '').trim(),
      tour_type: String(payload.tour_type || '').trim(),
      check_in: String(payload.check_in || '').trim(),
      check_out: String(payload.check_out || '').trim(),
      guests_count: safeNumber(payload.guests_count, 1),
      notes: String(payload.notes || '').trim(),
      status: 'new',
      created_at: new Date().toISOString()
    };

    db.bookings = db.bookings || [];
    db.bookings.unshift(booking);

    // analytics
    db.analytics = db.analytics || {};
    db.analytics.bookings = safeNumber(db.analytics.bookings, 0) + 1;
    db.analytics.updated_at = new Date().toISOString();

    await writeDb(db);
    res.json({ ok: true, booking });
  } catch (e) { next(e); }
});

// ----------------------------------------------------------------------------
// Admin API
// ----------------------------------------------------------------------------
app.get('/api/admin/bookings', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);
    res.json(db.bookings || []);
  } catch (e) { next(e); }
});

app.post('/api/admin/bookings/:id', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const id = req.params.id;
    const status = String(req.body?.status || '').trim();
    const allowed = new Set(['new', 'in_progress', 'confirmed', 'cancelled', 'done']);
    if (!allowed.has(status)) return res.status(400).json({ ok: false, error: 'Invalid status' });

    const list = db.bookings || [];
    const idx = list.findIndex(b => b.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });

    list[idx].status = status;
    await writeDb(db);
    res.json({ ok: true, booking: list[idx] });
  } catch (e) { next(e); }
});

app.post('/api/admin/hotel', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const patch = req.body || {};
    const allowedKeys = [
      'name','tagline','description','about','address','phone','email','check_in','check_out','hero_image'
    ];

    for (const k of allowedKeys) {
      if (k in patch) db.hotel[k] = String(patch[k] ?? '').trim();
    }
    db.hotel.updated_at = new Date().toISOString();

    await writeDb(db);
    const { admin_password, ...hotelPublic } = db.hotel;
    res.json({ ok: true, hotel: hotelPublic });
  } catch (e) { next(e); }
});

app.post('/api/admin/visitor-count', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    db.hotel.visitor_count = Math.max(0, safeNumber(req.body?.count, db.hotel.visitor_count || 0));
    db.hotel.updated_at = new Date().toISOString();

    await writeDb(db);
    res.json({ ok: true, visitor_count: db.hotel.visitor_count });
  } catch (e) { next(e); }
});

app.post('/api/admin/password', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const nextPass = String(req.body?.new_password || '').trim();
    if (nextPass.length < 6) return res.status(400).json({ ok: false, error: 'Min 6 chars' });
    db.hotel.admin_password = nextPass;
    db.hotel.updated_at = new Date().toISOString();
    await writeDb(db);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Rooms CRUD
app.get('/api/admin/rooms', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);
    res.json(db.rooms || []);
  } catch (e) { next(e); }
});

app.post('/api/admin/rooms', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const r = req.body || {};
    const id = String(r.id || uuidv4());
    const room = {
      id,
      name: String(r.name || '').trim(),
      short_name: String(r.short_name || r.name || '').trim(),
      description: String(r.description || '').trim(),
      price_from: Math.max(0, safeNumber(r.price_from, 0)),
      currency: String(r.currency || '₽'),
      size: String(r.size || ''),
      beds: String(r.beds || ''),
      max_guests: Math.max(1, safeNumber(r.max_guests, 2)),
      features: Array.isArray(r.features) ? r.features.map(String) : [],
      images: Array.isArray(r.images) ? r.images.map(String) : [],
      popular: !!r.popular,
      sort_order: safeNumber(r.sort_order, 0)
    };

    if (!room.name) return res.status(400).json({ ok: false, error: 'Room name required' });

    db.rooms = db.rooms || [];
    const idx = db.rooms.findIndex(x => x.id === id);
    if (idx === -1) db.rooms.push(room);
    else db.rooms[idx] = room;

    await writeDb(db);
    res.json({ ok: true, room });
  } catch (e) { next(e); }
});

app.delete('/api/admin/rooms/:id', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const id = req.params.id;
    db.rooms = (db.rooms || []).filter(r => r.id !== id);
    await writeDb(db);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Tours CRUD
app.get('/api/admin/tours', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);
    res.json(db.tours || []);
  } catch (e) { next(e); }
});

app.post('/api/admin/tours', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const t = req.body || {};
    const id = String(t.id || uuidv4());
    const tour = {
      id,
      title: String(t.title || '').trim(),
      short_desc: String(t.short_desc || '').trim(),
      description: String(t.description || '').trim(),
      price: Math.max(0, safeNumber(t.price, 0)),
      currency: String(t.currency || '₽'),
      duration: String(t.duration || '').trim(),
      location: String(t.location || '').trim(),
      category: String(t.category || 'all').trim(),
      featured: !!t.featured,
      schedule: Array.isArray(t.schedule) ? t.schedule.map(String) : [],
      images: Array.isArray(t.images) ? t.images.map(String) : [],
      sort_order: safeNumber(t.sort_order, 0)
    };

    if (!tour.title) return res.status(400).json({ ok: false, error: 'Tour title required' });

    db.tours = db.tours || [];
    const idx = db.tours.findIndex(x => x.id === id);
    if (idx === -1) db.tours.push(tour);
    else db.tours[idx] = tour;

    await writeDb(db);
    res.json({ ok: true, tour });
  } catch (e) { next(e); }
});

app.delete('/api/admin/tours/:id', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const id = req.params.id;
    db.tours = (db.tours || []).filter(t => t.id !== id);
    await writeDb(db);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Categories CRUD
app.get('/api/admin/categories', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);
    res.json(db.categories || []);
  } catch (e) { next(e); }
});

app.post('/api/admin/categories', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const c = req.body || {};
    const id = String(c.id || uuidv4());
    const cat = {
      id,
      name: String(c.name || '').trim(),
      icon: String(c.icon || '✨'),
      sort_order: safeNumber(c.sort_order, 0)
    };
    if (!cat.name) return res.status(400).json({ ok: false, error: 'Category name required' });

    db.categories = db.categories || [];
    const idx = db.categories.findIndex(x => x.id === id);
    if (idx === -1) db.categories.push(cat);
    else db.categories[idx] = cat;

    await writeDb(db);
    res.json({ ok: true, category: cat });
  } catch (e) { next(e); }
});

app.delete('/api/admin/categories/:id', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const id = req.params.id;
    db.categories = (db.categories || []).filter(c => c.id !== id);
    await writeDb(db);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Backup
app.get('/api/admin/backup', async (req, res, next) => {
  try {
    const db = await readDb();
    requireAdmin(req, db);

    const fileName = `backup-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(db, null, 2));
  } catch (e) { next(e); }
});

// ----------------------------------------------------------------------------
// Routes for SPA-ish admin (nice URLs)
// ----------------------------------------------------------------------------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ----------------------------------------------------------------------------
// Error handling
// ----------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const msg = status === 500 ? 'Server error' : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ ok: false, error: msg });
});

app.listen(PORT, () => {
  console.log(`Halachi server running: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});
