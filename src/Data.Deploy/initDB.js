const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const settings = require("../settings.json").settings;
const { Tables } = require("../Constants/Tables");

class DBInitializer {
  static #db = null;

  static async init() {
    if (!fs.existsSync(settings.dbPath)) {
      this.#db = new sqlite3.Database(settings.dbPath);
      await this.#runQuery("PRAGMA foreign_keys = ON");

      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.CONTRACTVERSION} (
        Id INTEGER,
        Version FLOAT NOT NULL,
        Description TEXT,
        CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
        LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY("Id" AUTOINCREMENT)
      )`);

      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.SQLSCRIPTMIGRATIONS} (
        Id INTEGER,
        Sprint TEXT NOT NULL,
        ScriptName TEXT NOT NULL,
        ExecutedTimestamp TEXT,
        PRIMARY KEY("Id" AUTOINCREMENT)
      )`);

      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.TOKENINFO} (
        Id INTEGER,
        Name TEXT NOT NULL,
        Symbol TEXT NOT NULL,
        Decimals INTEGER NOT NULL,
        CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY("Id" AUTOINCREMENT)
      )`);

      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.BALANCES} (
        PubKey TEXT NOT NULL,
        Balance TEXT NOT NULL,
        PRIMARY KEY("PubKey")
      )`);

      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.ROLES} (
        PubKey TEXT NOT NULL,
        Role TEXT NOT NULL,
        CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY("PubKey", "Role")
      )`);

      await this.#runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.PAUSESTATE} (
        Id INTEGER,
        IsPaused INTEGER NOT NULL,
        LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY("Id")
      )`);

      await this.#runQuery(`INSERT OR IGNORE INTO ${Tables.PAUSESTATE} (Id, IsPaused) VALUES (1, 0)`);

      this.#db.close();
      this.#db = null;
    }

    if (fs.existsSync(settings.dbPath)) {
      this.#db = new sqlite3.Database(settings.dbPath);

      const lastSprintQuery = `SELECT Sprint FROM ${Tables.SQLSCRIPTMIGRATIONS} ORDER BY Sprint DESC LIMIT 1`;
      const last = await this.#getRecord(lastSprintQuery);
      const lastExecutedSprint = last ? last.Sprint : "Sprint_00";

      const scriptsRoot = settings.dbScriptsFolderPath;
      if (fs.existsSync(scriptsRoot)) {
        const scriptFolders = fs
          .readdirSync(scriptsRoot)
          .filter(folder => folder.startsWith("Sprint_") && folder >= lastExecutedSprint)
          .sort();

        for (const sprintFolder of scriptFolders) {
          const sprintFolderPath = path.join(scriptsRoot, sprintFolder);
          const sqlFiles = fs
            .readdirSync(sprintFolderPath)
            .filter(file => file.match(/^\d+_.+\.sql$/))
            .sort();

          for (const sqlFile of sqlFiles) {
            const scriptPath = path.join(sprintFolderPath, sqlFile);
            const checkQuery = `SELECT * FROM ${Tables.SQLSCRIPTMIGRATIONS} WHERE Sprint = ? AND ScriptName = ?`;
            const rc = await this.#getRecord(checkQuery, [sprintFolder, sqlFile]);
            if (!rc) {
              const sqlScript = fs.readFileSync(scriptPath, "utf8");
              const sqlStatements = sqlScript
                .split(";")
                .map(statement =>
                  statement
                    .split(/\?\
/)
                    .map(line => (line.trim().startsWith("--") ? "" : line))
                    .join("\
")
                )
                .filter(statement => statement.trim() !== "");

              for (const statement of sqlStatements) {
                await this.#runQuery(statement);
              }

              const insertQuery = `INSERT INTO ${Tables.SQLSCRIPTMIGRATIONS} (Sprint, ScriptName, ExecutedTimestamp) VALUES (?, ?, ?)`;
              await this.#runQuery(insertQuery, [sprintFolder, sqlFile, new Date().toISOString()]);
            }
          }
        }
      }

      this.#db.close();
      this.#db = null;
    }
  }

  static #runQuery(query, params) {
    return new Promise((resolve, reject) => {
      this.#db.run(query, params || [], function (err) {
        if (err) return reject(err);
        resolve({ lastId: this.lastID, changes: this.changes });
      });
    });
  }

  static #getRecord(query, params) {
    return new Promise((resolve, reject) => {
      this.#db.get(query, params || [], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
}

module.exports = { DBInitializer };
