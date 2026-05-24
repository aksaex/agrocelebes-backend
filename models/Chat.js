const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  percakapan: [
    {
      role: { type: String, enum: ['user', 'bot'] },
      text: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  kuotaHarian: {
    jumlah: { type: Number, default: 0 },
    terakhirChat: { type: Date, default: Date.now }
  }
}, { timestamps: true });

module.exports = mongoose.model('Chat', ChatSchema);