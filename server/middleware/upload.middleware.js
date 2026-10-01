const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG and WEBP images are allowed'));
    }
  }
});

const uploadToCloudinary = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'expense_receipts',
          resource_type: 'image',
          transformation: [
            {
              width: 1200,
              quality: 'auto'
            }
          ]
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      stream.end(req.file.buffer);
    });

    // Preserve the interface expected by existing controllers
    req.file.path = result.secure_url;
    req.file.filename = result.public_id;
    req.file.cloudinary = result;

    next();

  } catch (error) {
    next(error);
  }
};

module.exports = {
  single: (fieldName) => [
    upload.single(fieldName),
    uploadToCloudinary
  ]
};