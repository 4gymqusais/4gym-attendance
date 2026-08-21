// ADMIN CREATION SCRIPT
// Run once to create admin user, then delete this file

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connection string from your .env
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phone: String,
  role: String
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('BashidLathif@104', 10);
    
    const admin = new User({
      name: 'Admin',
      email: 'admin@4gym.ae',
      password: hashedPassword,
      phone: '+971501234567',
      role: 'admin'
    });
    
    await admin.save();
    console.log('✅ Admin created successfully!');
    console.log('Email: admin@4gym.ae');
    console.log('Password: BashidLathif@104');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createAdmin();
