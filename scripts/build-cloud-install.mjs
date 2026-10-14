// Builds deploy/oci/01_install_smartbank.sql: every database script, in the
// order a fresh schema needs, as ONE file that can be pasted into Oracle
// Database Actions (SQL worksheet -> Run Script) or run with SQLcl/SQL*Plus.
//
// Order matters: the reference rows of 03_seed_data.sql must exist before the
// triggers, and the BANK_TRANSACTION rows must be replayed AFTER the fraud
// engine is installed so TRG_FRAUD_MONITOR scores each of them.
//
//   node scripts/build-cloud-install.mjs          write the file
//   node scripts/build-cloud-install.mjs --check  fail if it is out of date (CI)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = (name) => readFileSync(join(root, "database", name), "utf8").replace(/\r\n/g, "\n").trimEnd();
const output = join(root, "deploy", "oci", "01_install_smartbank.sql");

const seed = db("03_seed_data.sql");
const marker = "\n-- ---------------------------------------------------------------------\n-- BANK_TRANSACTION";
const split = seed.indexOf(marker);
if (split < 0) throw new Error("03_seed_data.sql: BANK_TRANSACTION section marker not found");

const parts = [
  ["01_tables.sql", db("01_tables.sql")],
  ["02_constraints.sql", db("02_constraints.sql")],
  ["03_seed_data.sql (reference rows)", seed.slice(0, split)],
  ["05_functions.sql", db("05_functions.sql")],
  ["06_procedures.sql", db("06_procedures.sql")],
  ["07_triggers.sql", db("07_triggers.sql")],
  ["08_cursor.sql", db("08_cursor.sql")],
  ["09_package.sql", db("09_package.sql")],
  ["10_views.sql", db("10_views.sql")],
  ["11_indexes.sql", db("11_indexes.sql")],
  ["03_seed_data.sql (BANK_TRANSACTION replay through the fraud trigger)", seed.slice(split)],
  ["14_demo_customer_profile.sql", db("14_demo_customer_profile.sql")],
  ["15_api_security.sql", db("15_api_security.sql")],
  ["ords_endpoints.sql", db("ords_endpoints.sql")],
];

const header = `-- =====================================================================
-- SmartBank - deploy/oci/01_install_smartbank.sql   (GENERATED - do not edit)
-- Built by scripts/build-cloud-install.mjs from the files in database/.
--
-- Step 2 of the Autonomous Database installation. Run as SMARTBANK_USER on
-- an EMPTY schema (Database Actions -> SQL -> paste -> Run Script).
-- It creates the 12 tables, constraints, fraud engine, views, indexes,
-- synthetic demo data, the API security layer and the REST module.
-- It contains no passwords; demo logins are created in step 3.
-- =====================================================================

SET DEFINE OFF
`;

const body = parts
  .map(([name, sql]) => `\n-- >>>>>>>>>>>>>>>>>>>> ${name}\n${sql}\n`)
  .join("");

const text = `${header}${body}\nSELECT 'SmartBank installation finished' AS result FROM dual;\n`;

if (process.argv.includes("--check")) {
  const current = (() => {
    try {
      return readFileSync(output, "utf8").replace(/\r\n/g, "\n");
    } catch {
      return "";
    }
  })();
  if (current !== text) {
    console.error("deploy/oci/01_install_smartbank.sql is out of date. Run: node scripts/build-cloud-install.mjs");
    process.exit(1);
  }
  console.log("deploy/oci/01_install_smartbank.sql is up to date.");
} else {
  writeFileSync(output, text);
  console.log(`Wrote ${output}`);
}
