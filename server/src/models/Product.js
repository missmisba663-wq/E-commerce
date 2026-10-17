const mongoose = require('mongoose');
const slugify = require('../utils/slugify');

const CATEGORIES = ['plants', 'pots', 'tools', 'care'];

const wholeNumber = (label) => ({
  validator: Number.isInteger,
  message: `${label} must be a whole number`,
});

// Our photos are Creative Commons, and those licences ask for credit, so the credit travels with the image.
const imageCreditSchema = new mongoose.Schema(
  {
    author: { type: String, trim: true, maxlength: 200 },
    license: { type: String, trim: true, maxlength: 60 },
    source: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

// Only plants have care notes. Pots and tools leave this out.
const careSchema = new mongoose.Schema(
  {
    light: { type: String, trim: true, maxlength: 120 },
    water: { type: String, trim: true, maxlength: 120 },
    petSafe: { type: Boolean },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 120 },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 2000 },
    // Money is stored in pence. Floats and currency don't mix.
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      validate: wholeNumber('Price (in pence)'),
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: CATEGORIES, message: 'Category must be one of: ' + CATEGORIES.join(', ') },
    },
    imageUrl: { type: String, default: '', trim: true },
    imageCredit: { type: imageCreditSchema, default: undefined },
    care: { type: careSchema, default: undefined },
    stock: { type: Number, default: 0, min: [0, 'Stock cannot be negative'], validate: wholeNumber('Stock') },
    // Archived products stay in the database so old orders still point at something real.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ category: 1, isActive: 1 });

productSchema.pre('validate', function setSlug() {
  if (!this.slug && this.name) this.slug = slugify(this.name);
});

module.exports = mongoose.model('Product', productSchema);
module.exports.CATEGORIES = CATEGORIES;
