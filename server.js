require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Origin = require('./models/Origin');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// app.use(cors({
//   origin: [
//     'http://localhost:3000',
//     process.env.FRONTEND_URL,
//   ].filter(Boolean),
//   methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
// }));
app.use(cors())
app.use(express.json());

// ─── DB Connection ────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/origins_db')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const status = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status, db: status });
});
app.get('/wake', (req, res) => {
  res.json({ awake: true, time: new Date().toISOString() });
});

// ─── GET all origins ──────────────────────────────────────────────────────────
app.get('/api/origins', async (req, res) => {
  try {
    const origins = await Origin.find().sort({ origin: 1 });
    res.json(origins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST create origin ───────────────────────────────────────────────────────
// Origin stored in UPPERCASE
app.post('/api/origins', async (req, res) => {
  try {
    const { origin } = req.body;
    if (!origin || !origin.trim()) {
      return res.status(400).json({ error: 'Origin name is required.' });
    }

    const normalized = origin.trim().toUpperCase();

    const existing = await Origin.findOne({ origin: normalized });
    if (existing) {
      return res.status(409).json({ error: `Origin "${normalized}" already exists.` });
    }

    const doc = new Origin({ origin: normalized, locations: [] });
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE origin ────────────────────────────────────────────────────────────
app.delete('/api/origins/:id', async (req, res) => {
  try {
    const doc = await Origin.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Origin not found.' });
    res.json({ message: `Origin "${doc.origin}" deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST add location to origin ─────────────────────────────────────────────
// Location stored in lowercase
app.post('/api/origins/:id/locations', async (req, res) => {
  try {
    const { location } = req.body;
    if (!location || !location.trim()) {
      return res.status(400).json({ error: 'Location name is required.' });
    }

    const normalized = location.trim().toLowerCase();

    const doc = await Origin.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Origin not found.' });

    if (doc.locations.includes(normalized)) {
      return res.status(409).json({ error: `Location "${normalized}" already exists in this origin.` });
    }

    doc.locations.push(normalized);
    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE location from origin ─────────────────────────────────────────────
app.delete('/api/origins/:id/locations/:location', async (req, res) => {
  try {
    const locationNorm = decodeURIComponent(req.params.location).toLowerCase();

    const doc = await Origin.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Origin not found.' });

    const before = doc.locations.length;
    doc.locations = doc.locations.filter((l) => l !== locationNorm);

    if (doc.locations.length === before) {
      return res.status(404).json({ error: 'Location not found.' });
    }

    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET search ───────────────────────────────────────────────────────────────
// Origin search uses UPPERCASE, location search uses lowercase
app.get('/api/search', async (req, res) => {
  try {
    const originQ = req.query.origin ? req.query.origin.trim().toUpperCase() : '';
    const locationQ = req.query.location ? req.query.location.trim().toLowerCase() : '';

    if (!originQ && !locationQ) {
      return res.json([]);
    }

    const filter = {};
    if (originQ) {
      filter.origin = { $regex: originQ, $options: 'i' };
    }
    if (locationQ) {
      filter.locations = { $elemMatch: { $regex: locationQ, $options: 'i' } };
    }

    const results = await Origin.find(filter).sort({ origin: 1 });

    // For each result, annotate which locations matched
    const annotated = results.map((doc) => {
      const matchedLocs = locationQ
        ? doc.locations.filter((l) => l.includes(locationQ))
        : [];
      return {
        _id: doc._id,
        origin: doc.origin,
        locations: doc.locations,
        matchedLocs,
        createdAt: doc.createdAt,
      };
    });

    res.json(annotated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
