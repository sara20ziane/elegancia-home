// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
const code = readFileSync("docs/GOOGLE_SHEETS_RECEIVER.gs", "utf8");
const secret = "synthetic-test-secret";
function receiver() {
  const rows: unknown[][] = [];
  let locked = false;
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: (row: unknown[]) => rows.push([...row]),
    setFrozenRows: () => {},
    getRange: (row: number, column: number, length: number, width: number) => {
      if (length < 1) throw new Error("Empty range");
      const range = {
        getValues: () =>
          rows.slice(row - 1, row - 1 + length).map((r) => r.slice(column - 1, column - 1 + width)),
        setNumberFormat: () => range,
        setValues: (values: unknown[][]) => {
          rows[row - 1] = [...values[0]];
        },
      };
      return range;
    },
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => (key.includes("SECRET") ? secret : "test-sheet"),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    Utilities: {
      computeHmacSha256Signature: (body: string, key: string) => [
        ...createHmac("sha256", key).update(body).digest(),
      ],
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (data: string) => ({ setMimeType: () => JSON.parse(data) }),
    },
  };
  const post = runInNewContext(`${code}\ndoPost`, context) as (event: unknown) => {
    ok: boolean;
    revision?: string;
  };
  const send = (revision: string, name = "سارة", badSignature = false) => {
    const payload = {
      revision,
      event: "updated",
      order: {
        id: "aaaaaaaa-1111-4111-8111-111111111111",
        customer_name: name,
        phone: "0555123456",
        total: 9600,
        status: "confirmed",
        wilaya: "Alger",
      },
      items: [{ product_name: "Été · غطاء", quantity: 1 }],
    };
    const contents = JSON.stringify(payload);
    return post({
      postData: { contents },
      parameter: {
        sig: badSignature
          ? "a".repeat(64)
          : createHmac("sha256", secret).update(contents).digest("hex"),
      },
    });
  };
  return {
    rows,
    send,
    lock: () => {
      locked = true;
    },
  };
}
describe("récepteur Apps Script réel avec adaptateurs Google synthétiques", () => {
  it("vérifie HMAC-SHA256, crée la première ligne et conserve français/arabe", () => {
    const app = receiver();
    expect(app.send("1", "سارة", true).ok).toBe(false);
    expect(app.rows).toHaveLength(0);
    expect(app.send("1").ok).toBe(true);
    expect(app.rows).toHaveLength(2);
    expect(app.rows[1][5]).toBe("سارة");
    expect(app.rows[1][11]).toContain("Été · غطاء");
    expect(app.rows[1][6]).toBe("0555123456");
  });
  it("ne double pas une commande et refuse les révisions arrivées en retard", () => {
    const app = receiver();
    app.send("90071992547409931", "Nouvelle");
    app.send("90071992547409930", "Ancienne");
    app.send("90071992547409931", "Répétition");
    expect(app.rows).toHaveLength(2);
    expect(app.rows[1][5]).toBe("Nouvelle");
    app.send("90071992547409932", "Actualisée");
    expect(app.rows[1][5]).toBe("Actualisée");
  });
  it("neutralise les formules et ne supprime aucun onglet incompatible", () => {
    const app = receiver();
    app.send("1", " \t=IMPORTXML()");
    expect(app.rows[1][5]).toBe("' \t=IMPORTXML()");
    app.rows[0][0] = "DONNEES EXISTANTES";
    expect(app.send("2").ok).toBe(false);
    expect(app.rows[0][0]).toBe("DONNEES EXISTANTES");
  });
  it("demande une reprise si le verrou est pris", () => {
    const app = receiver();
    app.lock();
    expect(app.send("1").ok).toBe(false);
    expect(app.rows).toHaveLength(0);
  });
});
