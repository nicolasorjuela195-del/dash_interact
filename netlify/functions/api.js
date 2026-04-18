// ═══════════════════════════════════════════════════════════════════════════
// AI STRATEGY HUB — Netlify Function (Backend)
// Maneja SOLICITUDES y PROYECTOS contra Supabase
// Variables de entorno requeridas en Netlify:
//   SUPABASE_URL      → ej. https://xxxx.supabase.co
//   SUPABASE_ANON_KEY → clave anon/public de tu proyecto Supabase
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PROJECT_BUCKET    = 'project-covers';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  // ?resource=proyectos → maneja proyectos. Sin param → solicitudes (compat)
  const resource = (event.queryStringParameters && event.queryStringParameters.resource) || 'solicitudes';

  if (resource === 'proyectos') {
    return handleProyectos(event);
  }
  return handleSolicitudes(event);
};

// ─── SOLICITUDES (código original, sin cambios) ─────────────────────────────
async function handleSolicitudes(event) {
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitudes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          nombre:             data.nombre        || '',
          pais:               data.pais          || '',
          problema:           data.problema      || '',
          impacto_actual:     data.impacto       || '',
          usuarios:           data.usuarios      || '',
          medicion:           data.medicion      || '',
          equipo:             data.equipo        || '',
          urgencia:           data.urgencia           || '',
          compromiso_cliente: data.compromiso         || '',
          estado:             'Recibido',
          impacto_estimado:   data.impacto_estimado   || '',
        }),
      });
      return {
        statusCode: res.ok ? 200 : 500,
        headers: HEADERS,
        body: JSON.stringify({ success: res.ok }),
      };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/solicitudes?select=*&order=timestamp.desc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      const rows = await res.json();
      const data = rows.map(r => ({
        Timestamp:               r.timestamp,
        Nombre:                  r.nombre,
        País:                    r.pais,
        Problema:                r.problema,
        'Impacto Actual':        r.impacto_actual,
        Usuarios:                r.usuarios,
        'Medición':              r.medicion,
        Equipo:                  r.equipo,
        Urgencia:                r.urgencia,
        'Compromiso con Cliente': r.compromiso_cliente,
        Estado:                  r.estado,
        'Impacto Estimado':      r.impacto_estimado,
      }));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers: HEADERS, body: 'Method not allowed' };
}

// ─── PROYECTOS (nuevo) ──────────────────────────────────────────────────────
async function handleProyectos(event) {
  // POST: crear un proyecto (con upload opcional de imagen en base64)
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body);

      if (!data.nombre || !data.descripcion || !data.link || !data.owner) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Faltan campos obligatorios' }) };
      }

      let imagen_url = '';

      // Si viene imagen en base64, subirla a Supabase Storage
      if (data.imagen_base64 && data.imagen_nombre) {
        const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(data.imagen_base64);
        if (!match) {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Formato de imagen inválido' }) };
        }
        const mimeType = match[1];
        const base64Body = match[2];
        const buffer = Buffer.from(base64Body, 'base64');

        const ext = (data.imagen_nombre.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
        const slug = (data.nombre || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        const fileName = `${Date.now()}-${slug}.${ext}`;

        const uploadRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${PROJECT_BUCKET}/${fileName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': mimeType,
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'x-upsert': 'true',
            },
            body: buffer,
          }
        );

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'No se pudo subir la imagen', detail: errText }) };
        }

        imagen_url = `${SUPABASE_URL}/storage/v1/object/public/${PROJECT_BUCKET}/${fileName}`;
      }

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/proyectos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          nombre:      data.nombre,
          descripcion: data.descripcion,
          link:        data.link,
          owner:       data.owner,
          imagen_url:  imagen_url,
        }),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'No se pudo guardar el proyecto', detail: errText }) };
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true, imagen_url }) };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  // GET: listar proyectos
  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/proyectos?select=*&order=created_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      const rows = await res.json();
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(rows) };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers: HEADERS, body: 'Method not allowed' };
}
