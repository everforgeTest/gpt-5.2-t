const { AccessControlService } = require("../Services/Domain.Services/AccessControl.service");

class AccessController {
  #message = null;
  #svc = null;

  constructor(message) {
    this.#message = message;
    this.#svc = new AccessControlService();
  }

  async handleRequest(userPubKey) {
    switch (this.#message.Action) {
      case "GrantRole":
        return { success: await this.#svc.grantRole(userPubKey, this.#message.data && this.#message.data.targetPubKey, this.#message.data && this.#message.data.role) };
      case "RevokeRole":
        return { success: await this.#svc.revokeRole(userPubKey, this.#message.data && this.#message.data.targetPubKey, this.#message.data && this.#message.data.role) };
      case "HasRole":
        return { success: { hasRole: await this.#svc.hasRole(this.#message.data && this.#message.data.pubKey ? this.#message.data.pubKey : userPubKey, (this.#message.data && this.#message.data.role) || "") } };
      case "GetUserRoles":
        return { success: { pubKey: (this.#message.data && this.#message.data.pubKey) ? this.#message.data.pubKey.toLowerCase() : userPubKey.toLowerCase(), roles: await this.#svc.getUserRoles(this.#message.data && this.#message.data.pubKey ? this.#message.data.pubKey : userPubKey) } };
      default:
        return { error: { code: 400, message: "Invalid Access action." } };
    }
  }
}

module.exports = { AccessController };
