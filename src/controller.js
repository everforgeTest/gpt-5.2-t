const { ServiceTypes } = require("./Constants/ServiceTypes");
const { TokenController } = require("./Controllers/Token.Controller");
const { AccessController } = require("./Controllers/Access.Controller");
const { UpgradeController } = require("./Controllers/Upgrade.Controller");

class Controller {
  async handleRequest(user, message, isReadOnly) {
    let result;

    if (message && message.Service === ServiceTypes.TOKEN) {
      const c = new TokenController(message);
      result = await c.handleRequest(user.pubKey);
    } else if (message && message.Service === ServiceTypes.ACCESS) {
      const c = new AccessController(message);
      result = await c.handleRequest(user.pubKey);
    } else if (message && (message.Service === ServiceTypes.UPGRADE || message.service === ServiceTypes.UPGRADE)) {
      const c = new UpgradeController(message);
      result = await c.handleRequest(user);
    } else {
      result = { error: { code: 400, message: "Invalid service." } };
    }

    if (isReadOnly) {
      await this.sendOutput(user, result);
    } else {
      await this.sendOutput(user, message && message.promiseId ? { promiseId: message.promiseId, ...result } : result);
    }
  }

  async sendOutput(user, response) {
    await user.send(response);
  }
}

module.exports = { Controller };
