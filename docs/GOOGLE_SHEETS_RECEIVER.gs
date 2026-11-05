/** Elegancia Home · AGPL-3.0-only · adapted from Meykiio/openstore-dz. */
const SHEET_NAME = "Commandes Elegancia";
const COLUMNS = ["order_id", "revision", "event", "status", "created_at", "customer_name", "phone", "wilaya", "commune", "address", "delivery_method", "items", "subtotal", "delivery_fee", "total", "tracking_number", "tracking_url"];
function doPost(e) {
  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty("ELEGANCIA_EXPORT_SECRET");
  const body = e && e.postData && e.postData.contents;
  const signature = e && e.parameter && e.parameter.sig;
  if (!secret || !body || !verify(body, signature, secret)) return respond({ ok: false });
  let payload;
  try { payload = JSON.parse(body); } catch (_) { return respond({ ok: false }); }
  const order = payload.order;
  if (!order || !/^[0-9a-f-]{36}$/i.test(order.id) || !/^[1-9][0-9]*$/.test(String(payload.revision))) return respond({ ok: false });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return respond({ ok: false });
  try {
    const book = SpreadsheetApp.openById(properties.getProperty("ELEGANCIA_SHEET_ID"));
    const sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) { sheet.appendRow(COLUMNS); sheet.setFrozenRows(1); }
    const header = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
    if (header.join("|") !== COLUMNS.join("|")) return respond({ ok: false, error: "schema" });
    const length = sheet.getLastRow() - 1;
    const saved = length > 0 ? sheet.getRange(2, 1, length, 2).getValues() : [];
    const index = saved.findIndex(function (row) { return String(row[0]) === order.id; });
    const revision = String(payload.revision);
    if (index >= 0 && compareRevision(String(saved[index][1]), revision) >= 0) return respond({ ok: true, order_id: order.id, revision: revision });
    const items = (payload.items || []).map(function (i) { return i.quantity + " × " + i.product_name + (i.variant_label ? " (" + i.variant_label + ")" : ""); }).join(" | ");
    const row = [order.id, revision, payload.event, order.status, order.created_at, order.customer_name, order.phone, order.wilaya, order.commune, order.address, order.delivery_method, items, order.subtotal, order.delivery_fee, order.total, order.tracking_number, order.tracking_url].map(asText);
    const destination = index < 0 ? sheet.getLastRow() + 1 : index + 2;
    // Plain text keeps phone leading zeros and large revisions intact.
    const range = sheet.getRange(destination, 1, 1, row.length);
    range.setNumberFormat("@");
    range.setValues([row]);
    return respond({ ok: true, order_id: order.id, revision: revision });
  } catch (_) { return respond({ ok: false }); }
  finally { lock.releaseLock(); }
}
function verify(body, signature, secret) {
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = Utilities.computeHmacSha256Signature(body, secret).map(function (b) { return ((b & 255) + 256).toString(16).slice(1); }).join("");
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}
function compareRevision(a, b) { return a.length !== b.length ? a.length - b.length : a === b ? 0 : a > b ? 1 : -1; }
function asText(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" && /^[\s\uFEFF]*[=+@-]/.test(value) ? "'" + value : value;
}
function respond(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
