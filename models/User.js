const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },

  // Profile preferences
  dietary: { type: String, enum: ['', 'Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free'], default: '' },
  avatar: { type: String, default: '' },                            // emoji, '' = first letter of name
  avatarColor: { type: String, default: '#527462' },
  calorieGoal: { type: Number, min: 800, max: 6000, default: 2000 },

  // Per-user app data (loaded automatically after login)
  saved: { type: [mongoose.Schema.Types.Mixed], default: [] },      // saved recipes
  plans: { type: mongoose.Schema.Types.Mixed, default: {} },        // calendar: { 'YYYY-MM-DD': [{name,type}] }
  plan: { type: mongoose.Schema.Types.Mixed, default: {} },         // weekly plan: { Monday: [meal] }
  shopping: { type: [{ _id: false, text: String, done: Boolean }], default: [] },
  recent: { type: [String], default: [] },
  pantry: { type: [String], default: [] }                           // ingredients the user has at home                           // recent searches
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('User', userSchema);
