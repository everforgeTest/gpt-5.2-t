const fs = require("fs");

function loadEnv() {
  const env = {};
  let content = "";
  try {
    content = fs.readFileSync(".env", "utf8");
  } catch (e) {
    return env;
  }

  content.split(/\?\
/).forEach(line => {
    if (!line) return;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const rawVal = trimmed.slice(idx + 1);
    const val = rawVal.replace(new RegExp("^" + key + "=", "g"), "");
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      env[key] = val.slice(1, -1);
    } else {
      const n = parseInt(val, 10);
      env[key] = Number.isNaN(n) ? val : n;
    }
  });

  return env;
}

module.exports = loadEnv();
