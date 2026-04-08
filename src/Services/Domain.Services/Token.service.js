const settings = require("../../settings.json").settings;
const { Tables } = require("../../Constants/Tables");
const { Roles } = require("../../Constants/Roles");
const { ContractResponseTypes } = require("../../Constants/ContractResponses");
const { SqliteDatabase } = require("../Common.Services/dbHandler").default;
const { AccessControlService } = require("./AccessControl.service");

function assertIntStringAmount(amountStr) {
  if (typeof amountStr !== "string" || !/^(0|[1-9]\d*)$/.test(amountStr)) {
    throw { code: ContractResponseTypes.BAD_REQUEST, message: "Amount must be a non-negative integer string." };
  }
}

function addBigIntStr(a, b) {
  return (BigInt(a) + BigInt(b)).toString();
}

function subBigIntStr(a, b) {
  const x = BigInt(a);
  const y = BigInt(b);
  if (y > x) throw { code: ContractResponseTypes.FORBIDDEN, message: "Insufficient balance." };
  return (x - y).toString();
}

class TokenService {
  #dbPath = settings.dbPath;
  #db = null;
  #acs = null;

  constructor() {
    this.#db = new SqliteDatabase(this.#dbPath);
    this.#acs = new AccessControlService();
  }

  normalizePubKey(pubKeyHex) {
    if (!pubKeyHex || typeof pubKeyHex !== "string") return "";
    return pubKeyHex.toLowerCase();
  }

  async isPaused() {
    this.#db.open();
    try {
      const row = await this.#db.getRecord(`SELECT IsPaused FROM ${Tables.PAUSESTATE} WHERE Id = 1`, []);
      return (row && row.IsPaused === 1) ? true : false;
    } finally {
      this.#db.close();
    }
  }

  async setPaused(requesterPubKeyHex, paused) {
    const requester = this.normalizePubKey(requesterPubKeyHex);
    const isAdmin = await this.#acs.hasRole(requester, Roles.ADMIN);
    if (!isAdmin) throw { code: ContractResponseTypes.FORBIDDEN, message: "ADMIN role required." };

    this.#db.open();
    try {
      await this.#db.runQuery(
        `UPDATE ${Tables.PAUSESTATE} SET IsPaused = ?, LastUpdatedOn = CURRENT_TIMESTAMP WHERE Id = 1`,
        [paused ? 1 : 0]
      );
      return { isPaused: paused ? true : false };
    } finally {
      this.#db.close();
    }
  }

  async getTokenInfo() {
    this.#db.open();
    try {
      const row = await this.#db.getRecord(`SELECT Name, Symbol, Decimals FROM ${Tables.TOKENINFO} ORDER BY Id ASC LIMIT 1`, []);
      if (!row) return { initialized: false };
      return { initialized: true, name: row.Name, symbol: row.Symbol, decimals: row.Decimals };
    } finally {
      this.#db.close();
    }
  }

  async initToken(requesterPubKeyHex, name, symbol, decimals) {
    const requester = this.normalizePubKey(requesterPubKeyHex);
    if (!name || !symbol || decimals === undefined || decimals === null) {
      throw { code: ContractResponseTypes.BAD_REQUEST, message: "name, symbol, decimals are required." };
    }
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
      throw { code: ContractResponseTypes.BAD_REQUEST, message: "decimals must be an integer between 0 and 18." };
    }

    this.#db.open();
    try {
      const existing = await this.#db.getRecord(`SELECT Id FROM ${Tables.TOKENINFO} ORDER BY Id ASC LIMIT 1`, []);
      if (existing) {
        const isAdmin = await this.#acs.hasRole(requester, Roles.ADMIN);
        if (!isAdmin) throw { code: ContractResponseTypes.FORBIDDEN, message: "Token already initialized. ADMIN role required." };
        return { initialized: true, message: "Token already initialized." };
      }

      await this.#db.runQuery(
        `INSERT INTO ${Tables.TOKENINFO} (Name, Symbol, Decimals) VALUES (?, ?, ?)` ,
        [String(name), String(symbol), decimals]
      );

      await this.#db.runQuery(
        `INSERT OR IGNORE INTO ${Tables.ROLES} (PubKey, Role) VALUES (?, ?)` ,
        [requester, Roles.ADMIN]
      );

      return { initialized: true, admin: requester, name: String(name), symbol: String(symbol), decimals: decimals };
    } finally {
      this.#db.close();
    }
  }

  async getBalance(pubKeyHex) {
    const pk = this.normalizePubKey(pubKeyHex);
    this.#db.open();
    try {
      const row = await this.#db.getRecord(`SELECT Balance FROM ${Tables.BALANCES} WHERE PubKey = ?`, [pk]);
      return { pubKey: pk, balance: row ? row.Balance : "0" };
    } finally {
      this.#db.close();
    }
  }

  async getTotalSupply() {
    this.#db.open();
    try {
      const rows = await this.#db.runSelectQuery(`SELECT Balance FROM ${Tables.BALANCES}`, []);
      let total = 0n;
      for (const r of rows) total += BigInt(r.Balance);
      return { totalSupply: total.toString() };
    } finally {
      this.#db.close();
    }
  }

  async mint(requesterPubKeyHex, toPubKeyHex, amountStr) {
    if (await this.isPaused()) throw { code: ContractResponseTypes.FORBIDDEN, message: "Contract is paused." };
    assertIntStringAmount(amountStr);
    const requester = this.normalizePubKey(requesterPubKeyHex);
    const to = this.normalizePubKey(toPubKeyHex);
    if (!to) throw { code: ContractResponseTypes.BAD_REQUEST, message: "toPubKey is required." };

    const isMinter = await this.#acs.hasRole(requester, Roles.MINTER);
    const isAdmin = await this.#acs.hasRole(requester, Roles.ADMIN);
    if (!isMinter && !isAdmin) throw { code: ContractResponseTypes.FORBIDDEN, message: "MINTER or ADMIN role required." };

    this.#db.open();
    try {
      const row = await this.#db.getRecord(`SELECT Balance FROM ${Tables.BALANCES} WHERE PubKey = ?`, [to]);
      const current = row ? row.Balance : "0";
      const next = addBigIntStr(current, amountStr);
      await this.#db.runQuery(
        `INSERT INTO ${Tables.BALANCES} (PubKey, Balance) VALUES (?, ?) ON CONFLICT(PubKey) DO UPDATE SET Balance = excluded.Balance`,
        [to, next]
      );
      return { minted: amountStr, to: to, newBalance: next };
    } finally {
      this.#db.close();
    }
  }

  async burn(requesterPubKeyHex, amountStr) {
    if (await this.isPaused()) throw { code: ContractResponseTypes.FORBIDDEN, message: "Contract is paused." };
    assertIntStringAmount(amountStr);
    const requester = this.normalizePubKey(requesterPubKeyHex);

    const isBurner = await this.#acs.hasRole(requester, Roles.BURNER);
    const isAdmin = await this.#acs.hasRole(requester, Roles.ADMIN);
    if (!isBurner && !isAdmin) throw { code: ContractResponseTypes.FORBIDDEN, message: "BURNER or ADMIN role required." };

    this.#db.open();
    try {
      const row = await this.#db.getRecord(`SELECT Balance FROM ${Tables.BALANCES} WHERE PubKey = ?`, [requester]);
      const current = row ? row.Balance : "0";
      const next = subBigIntStr(current, amountStr);
      await this.#db.runQuery(
        `INSERT INTO ${Tables.BALANCES} (PubKey, Balance) VALUES (?, ?) ON CONFLICT(PubKey) DO UPDATE SET Balance = excluded.Balance`,
        [requester, next]
      );
      return { burned: amountStr, from: requester, newBalance: next };
    } finally {
      this.#db.close();
    }
  }

  async transfer(fromPubKeyHex, toPubKeyHex, amountStr) {
    if (await this.isPaused()) throw { code: ContractResponseTypes.FORBIDDEN, message: "Contract is paused." };
    assertIntStringAmount(amountStr);
    const from = this.normalizePubKey(fromPubKeyHex);
    const to = this.normalizePubKey(toPubKeyHex);
    if (!to) throw { code: ContractResponseTypes.BAD_REQUEST, message: "toPubKey is required." };
    if (from === to) throw { code: ContractResponseTypes.BAD_REQUEST, message: "Cannot transfer to self." };

    this.#db.open();
    try {
      await this.#db.runQuery("BEGIN IMMEDIATE TRANSACTION");

      const fromRow = await this.#db.getRecord(`SELECT Balance FROM ${Tables.BALANCES} WHERE PubKey = ?`, [from]);
      const toRow = await this.#db.getRecord(`SELECT Balance FROM ${Tables.BALANCES} WHERE PubKey = ?`, [to]);

      const fromBal = fromRow ? fromRow.Balance : "0";
      const toBal = toRow ? toRow.Balance : "0";

      const fromNext = subBigIntStr(fromBal, amountStr);
      const toNext = addBigIntStr(toBal, amountStr);

      await this.#db.runQuery(
        `INSERT INTO ${Tables.BALANCES} (PubKey, Balance) VALUES (?, ?) ON CONFLICT(PubKey) DO UPDATE SET Balance = excluded.Balance`,
        [from, fromNext]
      );
      await this.#db.runQuery(
        `INSERT INTO ${Tables.BALANCES} (PubKey, Balance) VALUES (?, ?) ON CONFLICT(PubKey) DO UPDATE SET Balance = excluded.Balance`,
        [to, toNext]
      );

      await this.#db.runQuery("COMMIT");
      return { from: from, to: to, amount: amountStr, fromNewBalance: fromNext, toNewBalance: toNext };
    } catch (e) {
      try {
        await this.#db.runQuery("ROLLBACK");
      } catch (_) {}
      throw e;
    } finally {
      this.#db.close();
    }
  }
}

module.exports = { TokenService };
