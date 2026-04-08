const { TokenService } = require("../Services/Domain.Services/Token.service");

class TokenController {
  #message = null;
  #svc = null;

  constructor(message) {
    this.#message = message;
    this.#svc = new TokenService();
  }

  async handleRequest(userPubKey) {
    switch (this.#message.Action) {
      case "Init":
        return { success: await this.#svc.initToken(userPubKey, this.#message.data && this.#message.data.name, this.#message.data && this.#message.data.symbol, this.#message.data && this.#message.data.decimals) };
      case "Mint":
        return { success: await this.#svc.mint(userPubKey, this.#message.data && this.#message.data.toPubKey, this.#message.data && this.#message.data.amount) };
      case "Burn":
        return { success: await this.#svc.burn(userPubKey, this.#message.data && this.#message.data.amount) };
      case "Transfer":
        return { success: await this.#svc.transfer(userPubKey, this.#message.data && this.#message.data.toPubKey, this.#message.data && this.#message.data.amount) };
      case "Pause":
        return { success: await this.#svc.setPaused(userPubKey, true) };
      case "Unpause":
        return { success: await this.#svc.setPaused(userPubKey, false) };
      case "GetPauseStatus":
        return { success: { isPaused: await this.#svc.isPaused() } };
      case "GetBalance":
        return { success: await this.#svc.getBalance(this.#message.data && this.#message.data.pubKey ? this.#message.data.pubKey : userPubKey) };
      case "GetTotalSupply":
        return { success: await this.#svc.getTotalSupply() };
      case "GetTokenInfo":
        return { success: await this.#svc.getTokenInfo() };
      default:
        return { error: { code: 400, message: "Invalid Token action." } };
    }
  }
}

module.exports = { TokenController };
