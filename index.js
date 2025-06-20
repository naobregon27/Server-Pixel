const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const Registro = require("./models/Registro");
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(require("cors")());
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Asegura que req.body funcione correctamente

// Conexión a MongoDB
mongoose.connect(
  "mongodb+srv://naobregon27:83nMg3x1iTzSKZfG@kommo.xa9nxvx.mongodb.net/"
);

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
    const existente = await Registro.findOne({ id });
    if (existente) {
      return res.status(409).json({ error: "Este ID ya fue registrado" });
    }

    // 4. Guardar en la base de datos
    const nuevoRegistro = new Registro({
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
    const leadResponse = await axios.get(`https://luchito4637.kommo.com/api/v4/leads/${leadId}`, {
      headers: {
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImVmNmE0MzhhYjA1NzBiZGM2MzZlMzZhNjYxNzc0MTRlMWE2N2M4YWU1ZjlhM2FlMzVhM2U1NDBjZmVlNTQ0YTQyY2E3MzJkNzQ3Yzk2MWNjIn0.eyJhdWQiOiJhMGE2ZjdmNC0xZWM2LTQ2MDgtOTc2OC1kODhkNTkxZmNiYTIiLCJqdGkiOiJlZjZhNDM4YWIwNTcwYmRjNjM2ZTM2YTY2MTc3NDE0ZTFhNjdjOGFlNWY5YTNhZTM1YTNlNTQwY2ZlZTU0NGE0MmNhNzMyZDc0N2M5NjFjYyIsImlhdCI6MTc1MDM3NjUxNCwibmJmIjoxNzUwMzc2NTE0LCJleHAiOjE3NjI2NDY0MDAsInN1YiI6IjEyMzkyMjY3IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMzODg1Mzc1LCJiYXNlX2RvbWFpbiI6ImtvbW1vLmNvbSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiZjRjYTNhNjMtZjBiMS00MDBmLWFhMzMtN2E1YWRmZmY2YzUwIiwiYXBpX2RvbWFpbiI6ImFwaS1jLmtvbW1vLmNvbSJ9.REbQoMKKYrW9i6mBWru7-au3vprf8pQVi_REI664sxOB1410DuatdDoK0kFGEKCznqI-vUv_q1IongKpqSG-7MgZE_X7a5AMcG1AqpgbRHsoCcSde7JMqxhxm7QzD-bS8y4LYzRyRq0Z-QjspgxdqT67SrIFnfB1AonRgW1CwqG99SF_LM8f5_RlHworxnB0t90Dx-0ztjwMf32iavcchs8n91iMZmriFVLs-nQBezHLCpqlHrPSmdZLeTQn_w2Fdv2SqsXFMOXhjlKyIwckz3fEsn0MGstGZw9J-9xe1hzIa3xIEKQytuhuDUN_FiUU9fG839n-Xb13O2h-RsA7Tw'
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
      const registro = await Registro.findOne({ id: idExtraido });
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
  const url = `https://luchito4637.kommo.com/api/v4/leads/${leadId}?with=contacts`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImVmNmE0MzhhYjA1NzBiZGM2MzZlMzZhNjYxNzc0MTRlMWE2N2M4YWU1ZjlhM2FlMzVhM2U1NDBjZmVlNTQ0YTQyY2E3MzJkNzQ3Yzk2MWNjIn0.eyJhdWQiOiJhMGE2ZjdmNC0xZWM2LTQ2MDgtOTc2OC1kODhkNTkxZmNiYTIiLCJqdGkiOiJlZjZhNDM4YWIwNTcwYmRjNjM2ZTM2YTY2MTc3NDE0ZTFhNjdjOGFlNWY5YTNhZTM1YTNlNTQwY2ZlZTU0NGE0MmNhNzMyZDc0N2M5NjFjYyIsImlhdCI6MTc1MDM3NjUxNCwibmJmIjoxNzUwMzc2NTE0LCJleHAiOjE3NjI2NDY0MDAsInN1YiI6IjEyMzkyMjY3IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMzODg1Mzc1LCJiYXNlX2RvbWFpbiI6ImtvbW1vLmNvbSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiZjRjYTNhNjMtZjBiMS00MDBmLWFhMzMtN2E1YWRmZmY2YzUwIiwiYXBpX2RvbWFpbiI6ImFwaS1jLmtvbW1vLmNvbSJ9.REbQoMKKYrW9i6mBWru7-au3vprf8pQVi_REI664sxOB1410DuatdDoK0kFGEKCznqI-vUv_q1IongKpqSG-7MgZE_X7a5AMcG1AqpgbRHsoCcSde7JMqxhxm7QzD-bS8y4LYzRyRq0Z-QjspgxdqT67SrIFnfB1AonRgW1CwqG99SF_LM8f5_RlHworxnB0t90Dx-0ztjwMf32iavcchs8n91iMZmriFVLs-nQBezHLCpqlHrPSmdZLeTQn_w2Fdv2SqsXFMOXhjlKyIwckz3fEsn0MGstGZw9J-9xe1hzIa3xIEKQytuhuDUN_FiUU9fG839n-Xb13O2h-RsA7Tw'
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
  const url = `https://luchito4637.kommo.com/api/v4/contacts/${contactId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImVmNmE0MzhhYjA1NzBiZGM2MzZlMzZhNjYxNzc0MTRlMWE2N2M4YWU1ZjlhM2FlMzVhM2U1NDBjZmVlNTQ0YTQyY2E3MzJkNzQ3Yzk2MWNjIn0.eyJhdWQiOiJhMGE2ZjdmNC0xZWM2LTQ2MDgtOTc2OC1kODhkNTkxZmNiYTIiLCJqdGkiOiJlZjZhNDM4YWIwNTcwYmRjNjM2ZTM2YTY2MTc3NDE0ZTFhNjdjOGFlNWY5YTNhZTM1YTNlNTQwY2ZlZTU0NGE0MmNhNzMyZDc0N2M5NjFjYyIsImlhdCI6MTc1MDM3NjUxNCwibmJmIjoxNzUwMzc2NTE0LCJleHAiOjE3NjI2NDY0MDAsInN1YiI6IjEyMzkyMjY3IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMzODg1Mzc1LCJiYXNlX2RvbWFpbiI6ImtvbW1vLmNvbSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiZjRjYTNhNjMtZjBiMS00MDBmLWFhMzMtN2E1YWRmZmY2YzUwIiwiYXBpX2RvbWFpbiI6ImFwaS1jLmtvbW1vLmNvbSJ9.REbQoMKKYrW9i6mBWru7-au3vprf8pQVi_REI664sxOB1410DuatdDoK0kFGEKCznqI-vUv_q1IongKpqSG-7MgZE_X7a5AMcG1AqpgbRHsoCcSde7JMqxhxm7QzD-bS8y4LYzRyRq0Z-QjspgxdqT67SrIFnfB1AonRgW1CwqG99SF_LM8f5_RlHworxnB0t90Dx-0ztjwMf32iavcchs8n91iMZmriFVLs-nQBezHLCpqlHrPSmdZLeTQn_w2Fdv2SqsXFMOXhjlKyIwckz3fEsn0MGstGZw9J-9xe1hzIa3xIEKQytuhuDUN_FiUU9fG839n-Xb13O2h-RsA7Tw' // reemplazá por tu token válido
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