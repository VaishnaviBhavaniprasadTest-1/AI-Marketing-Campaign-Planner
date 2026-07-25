/* ============================================================
   FILE PARSER — turns an uploaded .csv, .xlsx, or .xls file
   into plain text insights appended to the AI prompt.
   CSV goes through PapaParse (handles quoting, delimiters,
   encoding quirks far more reliably than manual splitting).
   XLSX/XLS goes through SheetJS.
   Optional — the app works fully without any upload.
   ============================================================ */

let uploadedInsights = "";
let uploadedFileName = "";

function rowsToInsightText(sheetLabel, rows){
  let text = sheetLabel ? `\nSheet: ${sheetLabel}\n` : "\n";
  const capped = rows.slice(0, 40);
  capped.forEach((row) => {
    const cells = Array.isArray(row) ? row : Object.values(row);
    const line = cells.filter((c) => c !== null && c !== undefined && String(c).trim() !== "").join(" | ");
    if (line.trim()) text += line + "\n";
  });
  return text;
}

function parseCSVFile(file){
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || !results.data.length){
          reject(new Error("The CSV appears to be empty."));
          return;
        }
        resolve(rowsToInsightText(null, results.data).trim());
      },
      error: (err) => reject(new Error(err.message || "Could not parse CSV."))
    });
  });
}

function parseSpreadsheetFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try{
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        let combined = "";
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          if (rows.length) combined += rowsToInsightText(sheetName, rows);
        });
        if (!combined.trim()){
          reject(new Error("No readable data found in that file."));
          return;
        }
        resolve(combined.trim());
      } catch(err){
        reject(new Error(err.message || "Could not parse that spreadsheet."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsArrayBuffer(file);
  });
}

function parseUploadedFile(file){
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".csv")) return parseCSVFile(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseSpreadsheetFile(file);
  // Fallback: try CSV parsing first (handles plain text / mislabeled files), then spreadsheet
  return parseCSVFile(file).catch(() => parseSpreadsheetFile(file));
}

function initExcelUpload(){
  const zone = document.getElementById("uploadZone");
  const input = document.getElementById("excelInput");
  const label = document.getElementById("uploadLabel");
  const summary = document.getElementById("excelSummary");

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.style.borderColor = "var(--cyan)"; });
  zone.addEventListener("dragleave", () => { zone.style.borderColor = ""; });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.style.borderColor = "";
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  input.addEventListener("change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  async function handleFile(file){
    label.textContent = `Parsing ${file.name}…`;
    summary.textContent = "";
    try{
      const insights = await parseUploadedFile(file);
      uploadedInsights = insights;
      uploadedFileName = file.name;
      zone.classList.add("has-file");
      label.textContent = `✓ ${file.name} loaded`;
      const rowCount = insights.split("\n").filter(Boolean).length;
      summary.textContent = `${rowCount} lines parsed and will be fed into the AI prompt.`;
    } catch(err){
      console.warn("File parse error:", err);
      uploadedInsights = "";
      uploadedFileName = "";
      zone.classList.remove("has-file");
      label.textContent = "Drop a .csv / .xlsx file, or click to browse";
      summary.textContent = "";
      showToast(err.message || "Couldn't read that file — try a plain .csv or .xlsx export.", "error");
      input.value = "";
    }
  }
}

document.addEventListener("DOMContentLoaded", initExcelUpload);
