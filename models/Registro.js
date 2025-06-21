const mongoose = require('mongoose');

const registroSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    token: {
        type: String,
        required: true,
    },
    pixel: {
        type: String,
        required: true,
    },
    subdominio: {
        type: String,
        required: true,
    },
    dominio: {
        type: String,
        required: true,
    },
    ip: {
        type: String,
        required: true,
    },
    fbclid: String,
    mensaje: String,
    kommoAccount: {
        type: String,
        required: true,
    },
    whatsappNumber: {
        type: String,
        required: true,
    },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Registro', registroSchema);