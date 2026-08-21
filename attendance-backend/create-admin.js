// ADMIN CREATION / RESET SCRIPT  —  4GYM QUSAIS
//
// Credentials are NEVER stored in this file. You pass them in at run time:
//
//   Windows PowerShell:
//     $env:MONGO_URI="<your mongodb connection string>"
//     $env:ADMIN_EMAIL="admin@4gym.ae"
//     $env:ADMIN_PASSWORD="<the password you want>"
//     node create-admin.js
//
//   macOS / Linux:
//     MONGO_URI="..." ADMIN_EMAIL="admin@4gym.ae" ADMIN_PASSWORD="..." node create-admin.js
//
// Safe to re-run: if the account already exists its password and role are reset.

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const MONGO_URI      = process.env.MONGO_URI || process.env.MONGO_URL;
const ADMIN_EMAIL    = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME     = process.env.ADMIN_NAME  || 'Admin';
const ADMIN_PHONE    = process.env.ADMIN_PHONE || '';

// server.js allows only: staff | manager | owner
// App.jsx unlocks the Admin Panel for 'owner' or 'manager'. 'admin' is NOT a valid
// role and gets no admin access — that is the bug in the original script.
const ADMIN_ROLE = 'owner';

function fail(msg) { console.error('X ' + msg); process.exit(1); }

if (!MONGO_URI)      fail('Neither MONGO_URI nor MONGO_URL is set.');
if (!ADMIN_EMAIL)    fail('ADMIN_EMAIL is not set.');
if (!ADMIN_PASSWORD) fail('ADMIN_PASSWORD is not set.');
if (ADMIN_PASSWORD.length < 10) fail('ADMIN_PASSWORD should be at least 10 characters.');

// Schema kept identical to server.js so validation behaves the same.
const userSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String, unique: true, required: true },
  phone:         String,
  password:      { type: String, required: true },
  role:          { type: String, enum: ['staff', 'manager', 'owner'], default: 'staff' },
  gym_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Gym' },
  profile_photo: String,
  active:        { type: Boolean, default: true },
  created_at:    { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('- Connected to MongoDB');

    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      existing.password = hashed;
      existing.role     = ADMIN_ROLE;
      existing.active   = true;
      if (ADMIN_NAME)  existing.name  = ADMIN_NAME;
      if (ADMIN_PHONE) existing.phone = ADMIN_PHONE;
      await existing.save();
      console.log('- Existing account updated: password reset, role set to ' + ADMIN_ROLE);
    } else {
      await new User({
        name:     ADMIN_NAME,
        email:    ADMIN_EMAIL,
        password: hashed,
        phone:    ADMIN_PHONE,
        role:     ADMIN_ROLE,
        active:   true
      }).save();
      console.log('- Admin account created with role ' + ADMIN_ROLE);
    }

    console.log('- Log in at https://4gym-attendance.vercel.app/ using the EMAIL above.');
    console.log('- The password is not printed here on purpose.');
  } catch (err) {
    console.error('X Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
