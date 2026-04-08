const settings = require("../../settings.json").settings;
const { Tables } = require("../../Constants/Tables");
const { Roles } = require("../../Constants/Roles");
const { ContractResponseTypes } = require("../../Constants/ContractResponses");
const { SqliteDatabase } = require("../Common.Services/dbHandler").default;

class AccessControlService {
  #dbPath = settings.dbPath;
  #db = null;

  constructor() {
    this.#db = new SqliteDatabase(this.#dbPath);
  }

  normalizePubKey(pubKeyHex) {
    if (!pubKeyHex || typeof pubKeyHex !== "string") return "";
    return pubKeyHex.toLowerCase();
  }

  async hasRole(pubKeyHex, role) {
    const pk = this.normalizePubKey(pubKeyHex);
    this.#db.open();
    try {
      const row = await this.#db.getRecord(
        `SELECT 1 as Ok FROM ${Tables.ROLES} WHERE PubKey = ? AND Role = ? LIMIT 1`,
        [pk, role]
      );
      return !!row;
    } finally {
      this.#db.close();
    }
  }

  async getUserRoles(pubKeyHex) {
    const pk = this.normalizePubKey(pubKeyHex);
    this.#db.open();
    try {
      const rows = await this.#db.runSelectQuery(
        `SELECT Role FROM ${Tables.ROLES} WHERE PubKey = ? ORDER BY Role ASC`,
        [pk]
      );
      return rows.map(r => r.Role);
    } finally {
      this.#db.close();
    }
  }

  async grantRole(requesterPubKeyHex, targetPubKeyHex, role) {
    role = (role || "").toUpperCase();
    if (![Roles.ADMIN, Roles.MINTER, Roles.BURNER].includes(role)) {
      throw { code: ContractResponseTypes.BAD_REQUEST, message: "Invalid role." };
    }

    const requester = this.normalizePubKey(requesterPubKeyHex);
    const target = this.normalizePubKey(targetPubKeyHex);
    if (!target) throw { code: ContractResponseTypes.BAD_REQUEST, message: "targetPubKey is required." };

    const isAdmin = await this.hasRole(requester, Roles.ADMIN);
    if (!isAdmin) throw { code: ContractResponseTypes.FORBIDDEN, message: "ADMIN role required." };

    this.#db.open();
    try {
      await this.#db.runQuery(
        `INSERT OR IGNORE INTO ${Tables.ROLES} (PubKey, Role) VALUES (?, ?)` ,
        [target, role]
      );
      return { granted: true, role: role, pubKey: target };
    } finally {
      this.#db.close();
    }
  }

  async revokeRole(requesterPubKeyHex, targetPubKeyHex, role) {
    role = (role || "").toUpperCase();
    if (![Roles.ADMIN, Roles.MINTER, Roles.BURNER].includes(role)) {
      throw { code: ContractResponseTypes.BAD_REQUEST, message: "Invalid role." };
    }

    const requester = this.normalizePubKey(requesterPubKeyHex);
    const target = this.normalizePubKey(targetPubKeyHex);
    if (!target) throw { code: ContractResponseTypes.BAD_REQUEST, message: "targetPubKey is required." };

    const isAdmin = await this.hasRole(requester, Roles.ADMIN);
    if (!isAdmin) throw { code: ContractResponseTypes.FORBIDDEN, message: "ADMIN role required." };

    this.#db.open();
    try {
      const res = await this.#db.runQuery(
        `DELETE FROM ${Tables.ROLES} WHERE PubKey = ? AND Role = ?`,
        [target, role]
      );
      return { revoked: true, role: role, pubKey: target, changes: res.changes };
    } finally {
      this.#db.close();
    }
  }
}

module.exports = { AccessControlService };
