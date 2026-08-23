// ============================================
// 4GYM QUSAIS - Attendance Management System
// Backend API Server - Complete Implementation
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ============ DATABASE CONNECTION ============
// Accept either name. Railway's MongoDB plugin provisions MONGO_URL; older
// docs and .env.example use MONGO_URI. Previously this silently fell back to
// localhost, so a missing/misnamed variable looked like a healthy boot with a
// database that was never there. Fail loudly instead.
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;
if (!MONGO_URI) {
  console.error('FATAL: neither MONGO_URI nor MONGO_URL is set.');
  process.exit(1);
}
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('FATAL: MongoDB connection failed:', err.message);
  process.exit(1);
});

// ============ SCHEMAS & MODELS ============

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: String,
  password: { type: String, required: true },
  role: { type: String, enum: ['staff', 'manager', 'owner'], default: 'staff' },
  gym_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym' },
  profile_photo: String,
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const gymSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  latitude: Number,
  longitude: Number,
  geofence_radius: { type: Number, default: 100 },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gym_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true },
  check_in_time: Date,
  check_out_time: Date,
  check_in_photo: String,
  check_out_photo: String,
  check_in_location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  check_out_location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  status: { type: String, enum: ['checked_in', 'checked_out', 'late'], default: 'checked_in' },
  date: { type: Date, default: Date.now }
});

const leaveSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gym_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true },
  leave_type: { type: String, enum: ['sick', 'personal', 'vacation'] },
  from_date: Date,
  to_date: Date,
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Gym = mongoose.model('Gym', gymSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Leave = mongoose.model('Leave', leaveSchema);

// ============ AUTHENTICATION MIDDLEWARE ============
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start with a default secret.');
  process.exit(1);
}

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============ AUTHENTICATION ROUTES ============

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, gym_id } = req.body;

    // SECURITY: `role` is deliberately NOT read from the request body. Public
    // registration always creates a staff account. Elevating someone to
    // manager/owner is done by an existing owner via /api/staff/:id/role,
    // or offline with create-admin.js.

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (String(password).length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      role: 'staff',
      gym_id
    });

    await user.save();
    
    // Create token
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() }).populate('gym_id');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gym: user.gym_id
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ATTENDANCE ROUTES ============

// Check-in
app.post('/api/attendance/check-in', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    const user_id = req.user.id;

    // The client used to send the literal string 'default-gym' when the user had
    // no gym, which failed ObjectId casting and surfaced as a bare 500. Resolve
    // the gym from the request if it is a real id, otherwise from the user's own
    // record, and say plainly when there is none.
    let gym_id = req.body.gym_id;
    if (!gym_id || !mongoose.Types.ObjectId.isValid(gym_id)) {
      const me = await User.findById(user_id).select('gym_id');
      gym_id = me?.gym_id;
    }
    if (!gym_id) {
      return res.status(400).json({
        error: 'No gym is linked to your account yet. An owner needs to create a gym and assign you to it before you can check in.'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if already checked in today
    const existingCheckIn = await Attendance.findOne({
      user_id,
      gym_id,
      date: { $gte: today }
    });

    if (existingCheckIn?.check_in_time && !existingCheckIn.check_out_time) {
      return res.status(400).json({ error: 'Already checked in today' });
    }

    // Create attendance record
    const attendance = new Attendance({
      user_id,
      gym_id,
      check_in_time: new Date(),
      check_in_photo: req.file?.filename || null,
      check_in_location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: parseFloat(accuracy)
      },
      status: 'checked_in',
      date: today
    });

    await attendance.save();

    res.json({
      message: 'Checked in successfully',
      attendance: {
        id: attendance._id,
        check_in_time: attendance.check_in_time,
        status: 'checked_in'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check-out
app.post('/api/attendance/check-out', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { attendance_id, latitude, longitude, accuracy } = req.body;
    const user_id = req.user.id;

    // Fall back to today's open record when the client has no attendance_id
    // (e.g. the page was reloaded after checking in).
    let attendance = null;
    if (attendance_id && mongoose.Types.ObjectId.isValid(attendance_id)) {
      attendance = await Attendance.findOne({ _id: attendance_id, user_id });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      attendance = await Attendance.findOne({
        user_id,
        date: { $gte: today },
        check_out_time: null
      }).sort({ check_in_time: -1 });
    }

    if (!attendance) {
      return res.status(404).json({ error: 'No open check-in found for today.' });
    }

    if (attendance.check_out_time) {
      return res.status(400).json({ error: 'Already checked out' });
    }

    attendance.check_out_time = new Date();
    attendance.check_out_photo = req.file?.filename || null;
    attendance.check_out_location = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: parseFloat(accuracy)
    };
    attendance.status = 'checked_out';

    await attendance.save();

    res.json({
      message: 'Checked out successfully',
      attendance: {
        id: attendance._id,
        check_out_time: attendance.check_out_time,
        status: 'checked_out'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get today's attendance
app.get('/api/attendance/today', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Same as check-in: ignore a non-ObjectId gym_id (the client used to send
    // the string 'default') and fall back to the caller's own gym.
    let gym_id = req.query.gym_id;
    if (!gym_id || !mongoose.Types.ObjectId.isValid(gym_id)) {
      const me = await User.findById(req.user.id).select('gym_id');
      gym_id = me?.gym_id;
    }
    if (!gym_id) return res.json([]);

    const attendance = await Attendance.find({
      gym_id,
      date: { $gte: today }
    }).populate('user_id', 'name email phone');

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance history
app.get('/api/attendance/history/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { from_date, to_date, gym_id } = req.query;

    const query = { user_id, gym_id };

    if (from_date && to_date) {
      query.date = {
        $gte: new Date(from_date),
        $lte: new Date(to_date)
      };
    }

    const attendance = await Attendance.find(query).sort({ date: -1 });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STAFF MANAGEMENT ============

// Get all staff
app.get('/api/staff', authenticateToken, async (req, res) => {
  try {
    const { gym_id } = req.query;
    const staff = await User.find({ gym_id, role: 'staff' }).select('-password');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get staff statistics
// Change a user's role — owners only
app.put('/api/staff/:staff_id/role', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Only an owner can change roles' });
    }

    const { role } = req.body;
    if (!['staff', 'manager', 'owner'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const target = await User.findById(req.params.staff_id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Do not allow an owner to demote themselves and lock everyone out.
    if (String(target._id) === String(req.user.id) && role !== 'owner') {
      return res.status(400).json({ error: 'You cannot change your own owner role' });
    }

    target.role = role;
    await target.save();

    res.json({ message: 'Role updated', user: { id: target._id, email: target.email, role: target.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff/:staff_id/stats', authenticateToken, async (req, res) => {
  try {
    const { staff_id } = req.params;
    const { gym_id, month } = req.query;

    const startDate = new Date(new Date().getFullYear(), month - 1, 1);
    const endDate = new Date(new Date().getFullYear(), month, 0);

    const attendance = await Attendance.find({
      user_id: staff_id,
      gym_id,
      date: { $gte: startDate, $lte: endDate }
    });

    const presentDays = attendance.filter(a => a.check_in_time).length;
    const late = attendance.filter(a => a.status === 'late').length;
    const totalWorkingDays = 22;

    res.json({
      present: presentDays,
      absent: totalWorkingDays - presentDays,
      late,
      attendance_percentage: ((presentDays / totalWorkingDays) * 100).toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LEAVE MANAGEMENT ============

app.post('/api/leave/request', authenticateToken, async (req, res) => {
  try {
    const { gym_id, from_date, to_date, leave_type, reason } = req.body;
    const user_id = req.user.id;

    const leave = new Leave({
      user_id,
      gym_id,
      from_date: new Date(from_date),
      to_date: new Date(to_date),
      leave_type,
      reason
    });

    await leave.save();
    res.json({ message: 'Leave request submitted', leave });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/leave/:leave_id/approve', authenticateToken, async (req, res) => {
  try {
    const { leave_id } = req.params;
    const leave = await Leave.findByIdAndUpdate(
      leave_id,
      { status: 'approved' },
      { new: true }
    );
    res.json({ message: 'Leave approved', leave });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GYM MANAGEMENT ============

app.post('/api/gym/create', authenticateToken, async (req, res) => {
  try {
    const { name, location, latitude, longitude, geofence_radius } = req.body;
    const owner_id = req.user.id;

    const gym = new Gym({
      name,
      location,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      geofence_radius: geofence_radius || 100,
      owner_id
    });

    await gym.save();
    res.json({ message: 'Gym created successfully', gym });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gym/:gym_id', authenticateToken, async (req, res) => {
  try {
    const gym = await Gym.findById(req.params.gym_id);
    res.json(gym);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '4GYM Attendance API is running' });
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🏋️  4GYM QUSAIS Attendance API running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
  console.log(`✅ Ready to accept connections`);
});

module.exports = app;
