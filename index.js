const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const RegistroMacleyn = require("./models/Registro");
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(require("cors")());
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Asegura que req.body funcione correctamente

// Conexión a MongoDB con manejo de eventos
mongoose.connect("mongodb+srv://naobregon27:83nMg3x1iTzSKZfG@kommo.xa9nxvx.mongodb.net/")
  .then(() => {
    console.log('✅ Conexión exitosa a MongoDB Atlas');
  })
  .catch(err => {
    console.error('❌ Error de conexión a MongoDB:', err.message);
  });

// Eventos adicionales de conexión
mongoose.connection.on('connected', () => {
  console.log('🟢 MongoDB conectado');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 Error en la conexión de MongoDB:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('🟡 MongoDB desconectado');
});

const isValidIP = (ip) => {
  const regex =
    /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
  return regex.test(ip);
};

app.post("/guardar", async (req, res) => {
  try {
    const { id, token, pixel, subdominio, dominio, ip, fbclid, mensaje } =
      req.body;

    // 1. Verificación de campos obligatorios
    if (!id || !token || !pixel || !subdominio || !dominio || !ip) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // 2. Validación de tipos y formatos
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: "ID debe ser numérico" });
    }

    if (!isValidIP(ip)) {
      return res.status(400).json({ error: "IP no es válida" });
    }

    // 3. Evitar duplicados si el ID ya existe
    const existente = await RegistroMacleyn.findOne({ id });
    if (existente) {
      return res.status(409).json({ error: "Este ID ya fue registrado" });
    }

    // 4. Guardar en la base de datos
    const nuevoRegistro = new RegistroMacleyn({
      id,
      token,
      pixel,
      subdominio,
      dominio,
      ip,
      fbclid,
      mensaje,
    });
    await nuevoRegistro.save();

    res.status(201).json({ mensaje: "Datos guardados con éxito" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno al guardar los datos" });
  }
});

// Endpoint para verificar y ejecutar pixel - soporta GET y POST
app.post("/verificacion", async (req, res) => {
  const body = req.body;
  console.log(JSON.stringify(body, null, 2), "← este es lo que devuelve el body");
  const leadId = req.body?.leads?.add?.[0]?.id;

  if (!leadId) {
    return res.status(400).send("Lead ID no encontrado");
  }

  const contacto = await obtenerContactoDesdeLead(leadId);

  if (contacto) {
    console.log("🧾 ID del contacto:", contacto.id);

    // Paso 1: Traer el LEAD completo
    const leadResponse = await axios.get(`https://cajaadmi01.kommo.com/api/v4/leads/${leadId}`, {
      headers: {
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjIwMTMyNDA0YTJmMDI2NmIyYWIzZDcyMWMxZjQyMDA4ODE1YmZkMWViOGZjNTljNTBlZTJhNmJhNDQzMjYwYzFiZWZmMGZlZTk4NzFhMWJkIn0.eyJhdWQiOiI4YTNiNzZlMS01ODExLTRmOWMtODNiNi0zYWU2ZDhhNDFjMTUiLCJqdGkiOiIyMDEzMjQwNGEyZjAyNjZiMmFiM2Q3MjFjMWY0MjAwODgxNWJmZDFlYjhmYzU5YzUwZWUyYTZiYTQ0MzI2MGMxYmVmZjBmZWU5ODcxYTFiZCIsImlhdCI6MTc1MDQ1MzIxMiwibmJmIjoxNzUwNDUzMjEyLCJleHAiOjE3ODkxNzEyMDAsInN1YiI6IjExODczNzUxIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMzNDIyMzY3LCJiYXNlX2RvbWFpbiI6ImtvbW1vLmNvbSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiYWIzMWUwNmEtODQ3Yi00Y2M2LWJiNmEtNTQzY2Y3OWRhNmM0IiwiYXBpX2RvbWFpbiI6ImFwaS1nLmtvbW1vLmNvbSJ9.EPRqSq_Y_ZRUGW2xXLt7xegOKvF1kF3aYaU0XgyC-5imVqdGUq7vnzHHcFsQ5GKizBRasZHHkGtFsH_ng1zrFKlLN8xxoY5MykuJOGXvenNVZTEHGnMiD5azPuZ-JTB2WzEYpRnn2AGJXLvTjPA8QzTy7P1kVkfJSd8cq0PUk08JSLdODmR4r9_-sjmzStXhLlGlugKnzW9Ws4ojoul6SLHt71p-6w9XJVmjCqWAbnT_qFFJbKKNaMnXyXCpt7iSjm3B67bpE-MmYv0FKuv7FFkDxcAm9BhVoNbNkOIg3gNqQCnrJmDZNaUZWs5yx7hwtT0KE_Zkp6i6X93BRNBwhA'
      }
    });
    const lead = leadResponse.data;

    // Paso 2: Buscar el campo personalizado 'mensajeenviar'
    const campoMensaje = lead.custom_fields_values?.find(field =>
      field.field_name === "mensajeenviar"
    );
    const mensaje = campoMensaje?.values?.[0]?.value;

    console.log("📝 Mensaje guardado en el lead (mensajeenviar):", mensaje);

    // Paso 3: Extraer el ID si el mensaje incluye uno
    const idExtraido = mensaje?.match(/\d{13,}/)?.[0]; // extrae número de 13+ dígitos
    console.log("🧾 ID extraído del mensaje:", idExtraido);

    // Paso 4: Buscar en MongoDB si ese ID existe
    if (idExtraido) {
      const registro = await RegistroMacleyn.findOne({ id: idExtraido });
  // Ejecutar pixel de Meta (API de Conversiones)
  if (registro) {
  console.log("✅ Registro encontrado:", registro);

  try {
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
  
} else {
  console.log("❌ No se encontró un registro con ese ID");
}
} else {
  console.log("⚠️ No se pudo extraer un ID del mensaje");
}
    }
res.sendStatus(200);
});


async function obtenerContactoDesdeLead(leadId) {
  const url = `https://cajaadmi01.kommo.com/api/v4/leads/${leadId}?with=contacts`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjIwMTMyNDA0YTJmMDI2NmIyYWIzZDcyMWMxZjQyMDA4ODE1YmZkMWViOGZjNTljNTBlZTJhNmJhNDQzMjYwYzFiZWZmMGZlZTk4NzFhMWJkIn0.eyJhdWQiOiI4YTNiNzZlMS01ODExLTRmOWMtODNiNi0zYWU2ZDhhNDFjMTUiLCJqdGkiOiIyMDEzMjQwNGEyZjAyNjZiMmFiM2Q3MjFjMWY0MjAwODgxNWJmZDFlYjhmYzU5YzUwZWUyYTZiYTQ0MzI2MGMxYmVmZjBmZWU5ODcxYTFiZCIsImlhdCI6MTc1MDQ1MzIxMiwibmJmIjoxNzUwNDUzMjEyLCJleHAiOjE3ODkxNzEyMDAsInN1YiI6IjExODczNzUxIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMzNDIyMzY3LCJiYXNlX2RvbWFpbiI6ImtvbW1vLmNvbSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiYWIzMWUwNmEtODQ3Yi00Y2M2LWJiNmEtNTQzY2Y3OWRhNmM0IiwiYXBpX2RvbWFpbiI6ImFwaS1nLmtvbW1vLmNvbSJ9.EPRqSq_Y_ZRUGW2xXLt7xegOKvF1kF3aYaU0XgyC-5imVqdGUq7vnzHHcFsQ5GKizBRasZHHkGtFsH_ng1zrFKlLN8xxoY5MykuJOGXvenNVZTEHGnMiD5azPuZ-JTB2WzEYpRnn2AGJXLvTjPA8QzTy7P1kVkfJSd8cq0PUk08JSLdODmR4r9_-sjmzStXhLlGlugKnzW9Ws4ojoul6SLHt71p-6w9XJVmjCqWAbnT_qFFJbKKNaMnXyXCpt7iSjm3B67bpE-MmYv0FKuv7FFkDxcAm9BhVoNbNkOIg3gNqQCnrJmDZNaUZWs5yx7hwtT0KE_Zkp6i6X93BRNBwhA'
      }
    });

    const lead = response.data;
    const contacto = lead._embedded?.contacts?.[0]; // primer contacto vinculado

    if (!contacto) {
      console.log("⚠️ No se encontró ningún contacto asociado a este lead");
      return null;
    }

    console.log("✅ Contacto vinculado al lead:", contacto);
    return contacto;

  } catch (err) {
    console.error("❌ Error al obtener contacto desde lead:", err.response?.data || err.message);
    return null;
  }
}

async function obtenerDatosDelContacto(contactId) {
  const url = `https://cajaadmi01.kommo.com/api/v4/contacts/${contactId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjEwYmM2NjQ4OWU4Y2QwMzZhMDNlMzg4OGYzYzJiOWI5ZjA1ZGYyYzYwYWVkZWEyMzhlNjcwNjc2MDRlMGI5ZjE2NGYwZDE0ZmI2NDBjYTVlIn0.eyJhdWQiOiIxNTkwOTRjYy1kNjgyLTRiNGQtYTdhNS1mYThhZmU0MWVlZjQiLCJqdGkiOiIxMGJjNjY0ODllOGNkMDM2YTAzZTM4ODhmM2MyYjliOWYwNWRmMmM2MGFlZGVhMjM4ZTY3MDY3NjA0ZTBiOWYxNjRmMGQxNGZiNjQwY2E1ZSIsImlhdCI6MTc1MDQ1MTUyMywibmJmIjoxNzUwNDUxNTIzLCJleHAiOjE3ODEwNDk2MDAsInN1YiI6IjEzMTkyNTUxIiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjM0NTkxMzYzLCJiYXNlX2RvbWFpbiI6ImtvbW1vLmNvbSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiM2FiMWMxMzEtYmRjMC00OTM1LWE1YTEtZGUwNzM5MzIwOWQ4IiwiYXBpX2RvbWFpbiI6ImFwaS1jLmtvbW1vLmNvbSJ9.U2HzRLQxNqNj8SbpVAeTNiIAkN5UqClK1NkSRMD_Y3DUccdGtgyaIF7BccVN9d3l7POrO521ioRZi29yqPlBXNJIaexZJ8tYVBrOYGnPUfT57ZD8qdMo4PkPgIy-Mm2hEzVD7-1IMflI-eCmbaG-PYC6pc0nN0ue9LfIkylxcCMh4qoaoMacQCoCuZGvaPgMIc_OB1QdnlJ0MSXoMMUurp4JR8thVh7Kn9zZo9UQij-_2VDJwGY3twunyPouYzi-BeziLjzki0k-yL_MRTbxFGJG85uMkJ0ZbBmIGxVvOzgbtIlIZb47-MXBjNtwwwJCuyO_MqTE4K9gijw8QG344w' // reemplazá por tu token válido
      }
    });

    const contacto = response.data;

    console.log("✅ Datos completos del contacto:");
    console.log(JSON.stringify(contacto, null, 2));

    return contacto;

  } catch (error) {
    console.error("❌ Error al obtener el contacto:", error.response?.data || error.message);
    return null;
  }
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});