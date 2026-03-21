// ═══════════════════════════════════════════════════════════════════════════
// AI STRATEGY HUB — Google Apps Script Backend
// ═══════════════════════════════════════════════════════════════════════════
//
// INSTRUCCIONES DE SETUP:
//  1. Abre tu Google Sheet
//  2. Menú → Extensiones → Apps Script
//  3. Borra el contenido y pega TODO este archivo
//  4. Cambia SHEET_ID por el ID de tu hoja (ver instrucciones abajo)
//  5. Menú → Implementar → Nueva implementación
//     - Tipo: Aplicación web
//     - Ejecutar como: Yo (tu cuenta)
//     - Quién tiene acceso: Cualquier usuario
//  6. Copia la URL resultante y pégala en js/app.js → constante SCRIPT_URL
//
// CÓMO OBTENER EL SHEET_ID:
//  URL de tu hoja: https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_ID   = 'REEMPLAZA_CON_TU_SHEET_ID';
const SHEET_NAME = 'Solicitudes';

// Orden de columnas en el Google Sheet
const COLUMNS = [
  'Timestamp',
  'Nombre',
  'País',
  'Problema',
  'Impacto Actual',
  'Usuarios',
  'Medición',
  'Equipo',
  'Urgencia',
  'Compromiso con Cliente',
  'Estado',            // Administrado manualmente: Recibido / En Evaluación / Priorizado / En Desarrollo / Completado
  'Impacto Estimado',  // Administrado manualmente: Alto / Medio / Bajo
];

// ─── Inicializa la hoja con encabezados si está vacía ─────────────────────────
function setupSheet() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let sheet   = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    // Formato de encabezados
    const headerRange = sheet.getRange(1, 1, 1, COLUMNS.length);
    headerRange.setBackground('#FFD700');
    headerRange.setFontColor('#000000');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Ancho de columnas
    sheet.setColumnWidth(1, 160);  // Timestamp
    sheet.setColumnWidth(4, 300);  // Problema
    sheet.setColumnWidth(5, 260);  // Impacto Actual
    sheet.setColumnWidth(8, 200);  // Medición
  }

  return sheet;
}

// ─── POST: recibe un nuevo formulario ─────────────────────────────────────────
// El body viene como JSON con Content-Type: text/plain (evita preflight CORS)
function doPost(e) {
  try {
    const sheet  = setupSheet();
    const params = JSON.parse(e.postData.contents);

    const row = [
      new Date().toISOString(),            // Timestamp
      params.nombre      || '',
      params.pais        || '',
      params.problema    || '',
      params.impacto     || '',
      params.usuarios    || '',
      params.medicion    || '',
      params.equipo      || '',
      params.urgencia    || '',
      params.compromiso  || '',
      'Recibido',                          // Estado inicial
      '',                                  // Impacto Estimado (llenar manualmente)
    ];

    sheet.appendRow(row);

    return buildResponse({ success: true });
  } catch (err) {
    return buildResponse({ success: false, error: err.toString() });
  }
}

// ─── GET: devuelve todos los registros como JSON ──────────────────────────────
function doGet(e) {
  try {
    const sheet = setupSheet();
    const data  = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return buildResponse([]);
    }

    const headers = data[0];
    const rows    = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        // Formatear Timestamp si es Date
        obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
      });
      return obj;
    });

    return buildResponse(rows);
  } catch (err) {
    return buildResponse({ error: err.toString() });
  }
}

// ─── Helper: respuesta con headers CORS ───────────────────────────────────────
function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
