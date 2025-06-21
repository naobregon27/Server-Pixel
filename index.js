const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const Registro = require("./models/Registro");
const axios = require('axios');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(require("cors")());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Conexión a MongoDB
mongoose.connect("mongodb+srv://lauraahora4632025:hXqOPPuQ1INnrtkX@ahora4633.kcvqn5q.mongodb.net/")
  .then(() => console.log('✅ Conexión exitosa a MongoDB Atlas'))
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err.message));

// Configuración de cuentas Kommo (solo tokens y dominios)
const kommoAccounts = {
  'cajaadmi01': {
    token: process.env.KOMMO_TOKEN_1,
    domain: process.env.KOMMO_DOMAIN_1
  },
  'cuenta2': {
    token: process.env.KOMMO_TOKEN_2,
    domain: process.env.KOMMO_DOMAIN_2
  },
  'cuenta3': {
    token: process.env.KOMMO_TOKEN_3,
    domain: process.env.KOMMO_DOMAIN_3
  }
};

// Mapa para asociar números de WhatsApp con cuentas Kommo
const whatsappToKommoMap = new Map();

const isValidIP = (ip) => {
  const regex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
  return regex.test(ip);
};

app.post("/guardar", async (req, res) => {
  try {
    const { id, token, pixel, subdominio, dominio, ip, fbclid, mensaje, whatsappNumber } = req.body;

    // 1. Verificación de campos obligatorios
    if (!id || !token || !pixel || !subdominio || !dominio || !ip || !whatsappNumber) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // 2. Validaciones
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: "ID debe ser numérico" });
    }

    if (!isValidIP(ip)) {
      return res.status(400).json({ error: "IP no es válida" });
    }

    // 3. Guardar la asociación del número de WhatsApp con la cuenta Kommo
    // Por defecto usamos la primera cuenta (cajaadmi01)
    const kommoAccountId = 'cajaadmi01';
    whatsappToKommoMap.set(whatsappNumber, kommoAccountId);

    console.log("📱 Número de WhatsApp:", whatsappNumber);
    console.log("🔗 Asociado a la cuenta Kommo:", kommoAccountId);
    console.log("🌐 Dominio Kommo:", kommoAccounts[kommoAccountId].domain);

    // 4. Evitar duplicados
    const existente = await Registro.findOne({ id });
    if (existente) {
      return res.status(409).json({ error: "Este ID ya fue registrado" });
    }

    // 5. Guardar en la base de datos
    const nuevoRegistro = new Registro({
      id,
      token,
      pixel,
      subdominio,
      dominio,
      ip,
      fbclid,
      mensaje,
      kommoAccount: kommoAccountId,
      whatsappNumber
    });
    await nuevoRegistro.save();

    console.log("✅ Datos guardados exitosamente:");
    console.log({
      ID: id,
      "Número WhatsApp": whatsappNumber,
      "Cuenta Kommo": kommoAccountId,
      "Subdominio": subdominio,
      "IP": ip
    });

    res.status(201).json({ 
      mensaje: "Datos guardados con éxito",
      detalles: {
        whatsappNumber,
        kommoAccount: kommoAccountId
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno al guardar los datos" });
  }
});

app.post("/verificacion", async (req, res) => {
  try {
  const body = req.body;
  console.log(JSON.stringify(body, null, 2), "← este es lo que devuelve el body");
  const leadId = req.body?.leads?.add?.[0]?.id;

  if (!leadId) {
    return res.status(400).send("Lead ID no encontrado");
  }

    // Primero necesitamos obtener el mensaje para extraer el ID
    // Intentamos con cada cuenta hasta encontrar el lead
    let lead = null;
    let leadResponse = null;
    let kommoAccountUsed = null;

    // Intentar obtener el lead de cada cuenta hasta encontrarlo
    for (const [accountId, account] of Object.entries(kommoAccounts)) {
      try {
        leadResponse = await axios.get(`https://${account.domain}/api/v4/leads/${leadId}`, {
      headers: {
            'Authorization': `Bearer ${account.token}`
          }
        });
        if (leadResponse.data) {
          lead = leadResponse.data;
          kommoAccountUsed = { id: accountId, ...account };
          console.log(`✅ Lead encontrado en la cuenta ${accountId}`);
          break;
        }
      } catch (error) {
        console.log(`⚠️ No se encontró el lead en la cuenta ${accountId}`);
        continue;
      }
    }

    if (!lead) {
      console.error("❌ No se pudo encontrar el lead en ninguna cuenta");
      return res.sendStatus(200);
    }

    // Buscar el campo personalizado 'mensajeenviar'
    const campoMensaje = lead.custom_fields_values?.find(field =>
      field.field_name === "mensajeenviar"
    );
    const mensaje = campoMensaje?.values?.[0]?.value;

    // Extraer el ID del mensaje
    const idExtraido = mensaje?.match(/\d{13,}/)?.[0];
    console.log("🧾 ID extraído del mensaje:", idExtraido);

    if (!idExtraido) {
      console.log("⚠️ No se pudo extraer un ID del mensaje");
      return res.sendStatus(200);
    }

    // Buscar el registro en MongoDB
    const registro = await Registro.findOne({ id: idExtraido });
    
    if (!registro) {
      console.log("❌ No se encontró un registro con ese ID");
      return res.sendStatus(200);
    }

    // Verificar que estamos usando la cuenta correcta
    if (registro.kommoAccount !== kommoAccountUsed.id) {
      console.log(`⚠️ El lead se encontró en ${kommoAccountUsed.id} pero el registro corresponde a ${registro.kommoAccount}`);
      // Intentar obtener el lead con la cuenta correcta
      try {
        const correctAccount = kommoAccounts[registro.kommoAccount];
        leadResponse = await axios.get(`https://${correctAccount.domain}/api/v4/leads/${leadId}`, {
          headers: {
            'Authorization': `Bearer ${correctAccount.token}`
          }
        });
        lead = leadResponse.data;
        kommoAccountUsed = { id: registro.kommoAccount, ...correctAccount };
      } catch (error) {
        console.error("❌ Error al obtener el lead con la cuenta correcta:", error.message);
        return res.sendStatus(200);
      }
    }

    // Obtener el contacto usando las credenciales correctas
    const contacto = await obtenerContactoDesdeLead(leadId, kommoAccountUsed);

    if (contacto) {
      console.log("✅ Contacto encontrado:", contacto);

      try {
        // Ejecutar pixel de Meta
    const pixelResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${registro.pixel}/events`,
      {
        data: [
          {
            event_name: "LeadConfirmado",
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            event_source_url: `https://${registro.subdominio}.${registro.dominio}`,
            user_data: {
              client_ip_address: registro.ip,
              client_user_agent: req.headers["user-agent"],
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${registro.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📡 Pixel ejecutado con éxito:", pixelResponse.data);
  } catch (error) {
    console.error("❌ Error al ejecutar el pixel:", error.response?.data || error.message);
      }
    }

res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error general:", error);
    res.sendStatus(500);
  }
});

async function obtenerContactoDesdeLead(leadId, kommoAccount) {
  const url = `https://${kommoAccount.domain}/api/v4/leads/${leadId}?with=contacts`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kommoAccount.token}`
      }
    });

    const lead = response.data;
    return lead._embedded?.contacts?.[0];
  } catch (err) {
    console.error("❌ Error al obtener contacto desde lead:", err.response?.data || err.message);
    return null;
  }
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});