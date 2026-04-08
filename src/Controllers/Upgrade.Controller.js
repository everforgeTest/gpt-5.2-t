const env = require("../Utils/Environment");
const { ContractResponseTypes } = require("../Constants/ContractResponses");
const { UpgradeService } = require("../Services/Common.Services/Upgrade.Service");
const { verifyEd25519Detached } = require("../Utils/CryptoHelper");

function isMaintainer(userPubKeyHex) {
  const expected = String(env.MAINTAINER_PUBKEY || "").toLowerCase();
  if (!expected) return false;
  if (!userPubKeyHex) return false;
  return String(userPubKeyHex).toLowerCase() === expected;
}

class UpgradeController {
  #message = null;

  constructor(message) {
    this.#message = message;
  }

  async handleRequest(user) {
    try {
      const userPubKey = user.pubKey;
      if (!isMaintainer(userPubKey)) {
        return { error: { code: ContractResponseTypes.UNAUTHORIZED, message: "Unauthorized" } };
      }

      if (!this.#message.data || !this.#message.data.zipBase64 || !this.#message.data.zipSignatureHex) {
        return { error: { code: ContractResponseTypes.BAD_REQUEST, message: "zipBase64 and zipSignatureHex are required." } };
      }

      const zipBuffer = Buffer.from(this.#message.data.zipBase64, "base64");
      const ok = verifyEd25519Detached(zipBuffer, this.#message.data.zipSignatureHex, String(env.MAINTAINER_PUBKEY));
      if (!ok) {
        return { error: { code: ContractResponseTypes.UNAUTHORIZED, message: "Invalid upgrade signature." } };
      }

      const service = new UpgradeService(this.#message);
      return await service.upgradeContract();
    } catch (e) {
      return {
        error: {
          code: e.code || ContractResponseTypes.INTERNAL_SERVER_ERROR,
          message: e.message || "Upgrade failed."
        }
      };
    }
  }
}

module.exports = { UpgradeController };
