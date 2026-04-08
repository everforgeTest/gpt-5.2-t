const settings = require("../../settings.json").settings;
const { Tables } = require("../../Constants/Tables");
const { ContractResponseTypes } = require("../../Constants/ContractResponses");
const { SqliteDatabase } = require("./dbHandler").default;
const { FileService } = require("./FileService");
const { SharedService } = require("./SharedService");

class UpgradeService {
  #dbPath = settings.dbPath;
  #db = null;
  #message = null;

  constructor(message) {
    this.#message = message;
    this.#db = new SqliteDatabase(this.#dbPath);
  }

  async upgradeContract() {
    const resObj = {};

    try {
      const version = parseFloat(this.#message.data.version);
      const description = this.#message.data.description || "";
      const zipBase64 = this.#message.data.zipBase64;

      if (!zipBase64) {
        throw { code: ContractResponseTypes.BAD_REQUEST, message: "zipBase64 is required." };
      }
      if (!Number.isFinite(version)) {
        throw { code: ContractResponseTypes.BAD_REQUEST, message: "version must be a number." };
      }

      this.#db.open();
      const row = await this.#db.getRecord(
        `SELECT Version FROM ${Tables.CONTRACTVERSION} ORDER BY Id DESC LIMIT 1`,
        []
      );
      const currentVersion = row ? parseFloat(row.Version) : 1.0;
      if (!(version > currentVersion)) {
        throw {
          code: ContractResponseTypes.FORBIDDEN,
          message: `Incoming version (${version}) must be greater than current version (${currentVersion}).`
        };
      }

      const zipBuffer = Buffer.from(zipBase64, "base64");
      FileService.writeFile(settings.newContractZipFileName, zipBuffer);

      const shellScriptContent = `#!/bin/bash\
\
echo \"I am the post script\"\
\
! command -v unzip &>/dev/null && apt-get update && apt-get install --no-install-recommends -y unzip\
\
zip_file=\"${settings.newContractZipFileName}\"\
\
unzip -o -d ./ \"$zip_file\" >>/dev/null\
\
echo \"Zip file '$zip_file' has been successfully unzipped and its contents have been written to the current directory.\"\
\
rm \"$zip_file\" >>/dev/null\
`;

      FileService.writeFile(settings.postExecutionScriptName, shellScriptContent);
      FileService.changeMode(settings.postExecutionScriptName, 0o777);

      await this.#db.runQuery(
        `INSERT INTO ${Tables.CONTRACTVERSION} (Version, Description, CreatedOn, LastUpdatedOn) VALUES (?, ?, ?, ?)` ,
        [version, description, SharedService.context.timestamp, SharedService.context.timestamp]
      );

      resObj.success = { message: "Contract upgraded", version: version };
      return resObj;
    } catch (error) {
      resObj.error = {
        code: error.code || ContractResponseTypes.INTERNAL_SERVER_ERROR,
        message: error.message || "Failed to upgrade contract."
      };
      return resObj;
    } finally {
      try {
        this.#db.close();
      } catch (_) {}
    }
  }
}

module.exports = { UpgradeService };
