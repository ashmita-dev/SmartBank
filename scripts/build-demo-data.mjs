// Builds frontend/src/demo/seedData.json for the public DEMO MODE from the
// same synthetic rows Oracle is loaded with (database/03_seed_data.sql, plus
// the customer #1 rename in 14_demo_customer_profile.sql). No fraud alerts
// are stored: the demo replays the transactions through its JavaScript copy
// of the rules, like TRG_FRAUD_MONITOR does during an Oracle install.
//
//   node scripts/build-demo-data.mjs          write the file
//   node scripts/build-demo-data.mjs --check  fail if it is out of date (CI)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "frontend", "src", "demo", "seedData.json");
const sql = readFileSync(join(root, "database", "03_seed_data.sql"), "utf8");

// Seed timestamps were written as Indian wall-clock time (the laptop's zone).
const IST = "+05:30";
const toMs = (text) => Date.parse(`${text.trim().replace(" ", "T")}${text.includes(" ") ? "" : "T00:00:00"}${IST}`);

function parseValues(list) {
  const values = [];
  let i = 0;
  while (i < list.length) {
    const ch = list[i];
    if (ch === "," || ch === " ") { i++; continue; }
    if (ch === "'") {
      let out = "";
      i++;
      while (i < list.length) {
        if (list[i] === "'" && list[i + 1] === "'") { out += "'"; i += 2; continue; }
        if (list[i] === "'") { i++; break; }
        out += list[i++];
      }
      values.push(out);
      continue;
    }
    const literal = /^(DATE|TIMESTAMP)\s+'([^']*)'/i.exec(list.slice(i));
    if (literal) { values.push({ ms: toMs(literal[2]) }); i += literal[0].length; continue; }
    const word = /^[^,\s]+/.exec(list.slice(i))[0];
    values.push(word.toUpperCase() === "NULL" ? null : Number(word));
    i += word.length;
  }
  return values;
}

const tables = {};
const re = /^INSERT INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*)\)\s*(?:\/\*.*?\*\/)?\s*;\s*$/gim;
for (const match of sql.matchAll(re)) {
  const [, table, cols, vals] = match;
  const columns = cols.split(",").map((c) => c.trim().toLowerCase());
  const values = parseValues(vals);
  if (values.length !== columns.length) throw new Error(`Column/value mismatch in ${table}: ${match[0].slice(0, 80)}`);
  const row = Object.fromEntries(columns.map((c, k) => [c, values[k] && typeof values[k] === "object" ? values[k].ms : values[k]]));
  (tables[table.toLowerCase()] ||= []).push(row);
}

// Identity columns: rows get IDs 1..n in insert order, as on an empty schema.
const identity = {
  customer: "customer_id", customer_address: "address_id", merchant: "merchant_id", device: "device_id",
  account: "account_id", fraud_analyst: "analyst_id", bank_transaction: "transaction_id",
};
for (const [table, key] of Object.entries(identity)) {
  (tables[table] || []).forEach((row, index) => { row[key] = index + 1; });
}

// 14_demo_customer_profile.sql
const c1 = tables.customer.find((c) => c.customer_id === 1);
if (c1 && c1.first_name === "Aarav" && c1.last_name === "Sharma") {
  Object.assign(c1, { first_name: "Ashmita", last_name: "Mazumdar", email: "ashmita.mazumdar@mail.com" });
}

const expectedCounts = { customer: 15, account: 20, bank_transaction: 101, merchant: 8, device: 12, fraud_analyst: 2 };
for (const [table, n] of Object.entries(expectedCounts)) {
  if ((tables[table] || []).length !== n) throw new Error(`Expected ${n} ${table} rows, parsed ${(tables[table] || []).length}`);
}

const text = `${JSON.stringify({ source: "database/03_seed_data.sql + 14_demo_customer_profile.sql", tables }, null, 1)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(output, "utf8").replace(/\r\n/g, "\n"); } catch { /* missing */ }
  if (current !== text) {
    console.error("frontend/src/demo/seedData.json is out of date. Run: node scripts/build-demo-data.mjs");
    process.exit(1);
  }
  console.log("frontend/src/demo/seedData.json is up to date.");
} else {
  writeFileSync(output, text);
  console.log(`Wrote ${output}: ${Object.entries(tables).map(([t, r]) => `${t} ${r.length}`).join(", ")}`);
}
