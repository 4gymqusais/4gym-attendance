// ONE-TIME SETUP  —  4GYM QUSAIS
//
// Creates the gym, promotes an account to owner, and links every user to the
// gym. Run it once; it is safe to run again.
//
// Credentials are NEVER stored in this file — pass them in at run time.
//
//   Railway → your service → Console tab (MONGO_URL is already set there):
//     ADMIN_EMAIL="admin1@4gym.ae" node setup.js
//
//   To also (re)set that account's password, add ADMIN_PASSWORD:
//     ADMIN_EMAIL="admin1@4gym.ae" ADMIN_PASSWORD="your-password" node setup.js
//
//   Locally, add MONGO_URI="..." in front of the same command.

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const MONGO_URI      = process.env.MONGO_URI || process.env.MONGO_URL;
const ADMIN_EMAIL    = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const GYM_NAME       = process.env.GYM_NAME     || '4GYM QUSAIS';
const GYM_LOCATION   = process.env.GYM_LOCATION || 'Al Qusais, Dubai';
const GYM_LAT        = parseFloat(process.env.GYM_LAT  || '25.2518');
const GYM_LNG        = parseFloat(process.env.GYM_LNG  || '55.3783');

function fail(m) { console.error('X ' + m); process.exit(1); }
if (!MONGO_URI)   fail('Neither MONGO_URI nor MONGO_URL is set.');
if (!ADMIN_EMAIL) fail('ADMIN_EMAIL is not set.');
if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 10) fail('ADMIN_PASSWORD must be at least 10 characters.');

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

const User = mongoose.model('User', userSchema);
const Gym  = mongoose.model('Gym', gymSchema);

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('- Connected to MongoDB');

    // 1. The admin account must already exist (register it on the site first).
    const admin = await User.findOne({ email: ADMIN_EMAIL });
    if (!admin) {
      fail('No account found for ' + ADMIN_EMAIL + '. Register it on the site first, then re-run this.');
    }

    // 2. One gym, reused on re-runs.
    let gym = await Gym.findOne();
    if (!gym) {
      gym = await new Gym({
        name: GYM_NAME,
        location: GYM_LOCATION,
        latitude: GYM_LAT,
        longitude: GYM_LNG,
        geofence_radius: 100,
        owner_id: admin._id
      }).save();
      console.log('- Gym created: ' + gym.name + ' (' + gym._id + ')');
    } else {
      console.log('- Gym already exists: ' + gym.name + ' (' + gym._id + ')');
    }

    // 3. Promote the admin and link it to the gym.
    admin.role   = 'owner';
    admin.gym_id = gym._id;
    admin.active = true;
    if (ADMIN_PASSWORD) {
      admin.password = await bcrypt.hash(ADMIN_PASSWORD, 12);
      console.log('- Password reset for ' + ADMIN_EMAIL);
    }
    await admin.save();
    console.log('- ' + ADMIN_EMAIL + ' is now role=owner, linked to the gym');

    // 4. Anyone else without a gym gets this one, otherwise check-in fails
    //    for them with "No gym is linked to your account yet".
    const res = await User.updateMany(
      { $or: [{ gym_id: { $exists: false } }, { gym_id: null }] },
      { $set: { gym_id: gym._id } }
    );
    console.log('- Linked ' + res.modifiedCount + ' other user(s) to the gym');

    console.log('');
    console.log('Done. Log out and back in at https://4gym-attendance.vercel.app/');
    console.log('You should land on the admin panel instead of the check-in screen.');
  } catch (err) {
    console.error('X Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
