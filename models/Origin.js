const mongoose = require('mongoose');

const originSchema = new mongoose.Schema(
  {
    // Always stored in UPPERCASE
    origin: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Always stored in lowercase
    locations: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Enforce casing before save
originSchema.pre('save', function (next) {
  this.origin = this.origin.toUpperCase();
  this.locations = this.locations.map((l) => l.toLowerCase());
  next();
});

module.exports = mongoose.model('Origin', originSchema);
