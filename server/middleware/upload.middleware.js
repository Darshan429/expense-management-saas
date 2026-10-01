// server/middleware/upload.middleware.js
const multer      = require('multer');
const cloudinary  = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Store directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'expense_receipts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, quality: 'auto' }]
  }
});

module.exports = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });