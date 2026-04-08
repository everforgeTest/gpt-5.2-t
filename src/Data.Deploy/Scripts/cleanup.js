const fs = require("fs");
const settings = require("../../settings.json").settings;

(function main() {
  try {
    if (fs.existsSync(settings.dbPath)) {
      fs.unlinkSync(settings.dbPath);
      console.log("Deleted db", settings.dbPath);
    }
  } catch (e) {
    console.error("Cleanup failed", e);
  }
})();
