const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || '').trim();
const apiKey = (process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY || '').trim();
const apiSecret = (process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET || process.env.MY_CLOUDINARY_SECRET || '').trim();

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    'Missing Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME/CLOUDINARY_NAME, CLOUDINARY_API_KEY/CLOUDINARY_KEY, and CLOUDINARY_API_SECRET/CLOUDINARY_SECRET in .env'
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    resource_type: 'image'
  }
});

module.exports = multer({ storage: storage });