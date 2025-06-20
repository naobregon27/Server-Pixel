const mongoose = require('mongoose');

const registroSchema = new mongoose.Schema({
    id: String,
    token: String,
    pixel: String,
    subdominio: String,
    dominio: String,
    ip: String,
    fbClid: String,
    mensaje: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Registro', registroSchema);