import { supa, TABLE, ERROR_TABLE } from "./supabase";

// PostgREST caps how many rows one request may return, so everything
// here is paged. The cap is a server setting we cannot see from the
// browser, so the loop never assumes a page size — it keeps asking
// until a request comes back empty.
const PAGE = 1000;

// A runaway loop against a huge table would hang the tab. No greenhouse
// produces this many readings, so hitting it means something is wrong.
const MAX_ROWS = 250000;

async function fetchAll(table, columns, onProgress) {
  const out = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supa
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      throw new Error(
        /not find the table/i.test(error.message)
          ? `Table "${table}" not found.`
          : `${table}: ${error.message}`
      );
    }
    if (!data || data.length === 0) break;

    out.push(...data);
    from += data.length;
    if (onProgress) onProgress(out.length);

    if (out.length >= MAX_ROWS) break;
  }

  return out;
}

// Header styling is shared so both sheets read as one document.
function styleSheet(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EFEA" },
  };
  header.border = {
    bottom: { style: "thin", color: { argb: "FFC3D1C7" } },
  };

  // headers stay visible while scrolling a few thousand readings
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };
}

// Dates go in as real Date objects and numbers as real numbers, so
// Excel can sort, chart and filter them instead of seeing text.
const STAMP = "yyyy-mm-dd hh:mm:ss";

// A missing reading must stay empty. Number(null) and Number("") are
// both 0, which would land in the sheet as a real 0.0 °C and drag down
// every average and chart drawn from the column.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function buildWorkbook(onProgress) {
  // Only fetched when the user actually asks for a download, so the
  // ~900kB library never touches the initial page load.
  const { default: ExcelJS } = await import("exceljs/dist/exceljs.min.js");

  if (onProgress) onProgress("Reading sensor data…");
  const readings = await fetchAll(TABLE, "*");

  if (onProgress) onProgress("Reading error log…");
  const errors = await fetchAll(ERROR_TABLE, "id,error_type,error_message,created_at");

  if (onProgress) onProgress("Building workbook…");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Glasshouse";
  wb.created = new Date();

  // ---- readings ----
  const rs = wb.addWorksheet("Readings");
  rs.columns = [
    { header: "Time",            key: "t",   width: 22, style: { numFmt: STAMP } },
    { header: "Temperature (C)", key: "temp", width: 18, style: { numFmt: "0.0" } },
    { header: "Humidity (%)",    key: "hum",  width: 16, style: { numFmt: "0.0" } },
    { header: "Fan",             key: "fan",  width: 10 },
    { header: "System",          key: "sys",  width: 12 },
  ];
  for (const r of readings) {
    rs.addRow({
      t: new Date(r.created_at),
      temp: num(r.temperature),
      hum: num(r.humidity),
      // both columns predate the reporting that fills them, so older
      // rows legitimately have no value
      fan: r.fan_status === true ? "ON" : r.fan_status === false ? "OFF" : "",
      sys: r.system_on === true ? "ON" : r.system_on === false ? "STANDBY" : "",
    });
  }
  styleSheet(rs);

  // ---- errors ----
  const es = wb.addWorksheet("Errors");
  es.columns = [
    { header: "Time",    key: "t",   width: 22, style: { numFmt: STAMP } },
    { header: "Type",    key: "type", width: 20 },
    { header: "Message", key: "msg",  width: 70 },
  ];
  for (const e of errors) {
    es.addRow({
      t: new Date(e.created_at),
      type: e.error_type || "",
      msg: e.error_message || "",
    });
  }
  styleSheet(es);

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, readings: readings.length, errors: errors.length };
}

function stamp(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function downloadWorkbook(onProgress) {
  const { buffer, readings, errors } = await buildWorkbook(onProgress);

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `greenhouse-${stamp(new Date())}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // give the browser a moment to start the download before the blob goes
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return { readings, errors };
}
