const requiredKeys = ['MONGO_URI', 'JWT_SECRET'];
const recommendedKeys = ['GEMINI_API_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

const validateEnvironment = () => {
  const missingRequired = requiredKeys.filter((key) => !process.env[key]);
  const missingRecommended = recommendedKeys.filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`);
  }

  if (missingRecommended.length > 0) {
    console.warn(`⚠️ Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
};

module.exports = validateEnvironment;

