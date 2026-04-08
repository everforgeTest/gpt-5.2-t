const HotPocket = require("hotpocket-nodejs-contract");
const bson = require("bson");
const { Controller } = require("./controller");
const { DBInitializer } = require("./Data.Deploy/initDB");
const { SharedService } = require("./Services/Common.Services/SharedService");
//aaasad
const contract = async ctx => {
  console.log("Token contract is running.");

  SharedService.context = ctx;
  const isReadOnly = ctx.readonly;

  if (!isReadOnly) {
    ctx.unl.onMessage((node, msg) => {
      try {
        const obj = JSON.parse(msg.toString());
        if (obj && obj.type) {
          SharedService.nplEventEmitter.emit(obj.type, node, msg);
        }
      } catch (_) {}
    });
  }

  try {
    await DBInitializer.init();
  } catch (e) {
    console.error("DB init error", e);
  }

  const controller = new Controller();

  for (const user of ctx.users.list()) {
    for (const input of user.inputs) {
      const buf = await ctx.users.read(input);
      let message;
      try {
        message = JSON.parse(buf);
      } catch (e) {
        try {
          message = bson.deserialize(buf);
        } catch (_) {
          message = null;
        }
      }

      if (!message) {
        await user.send({ error: { code: 400, message: "Invalid message." } });
        continue;
      }

      if (message.Data && !message.data) message.data = message.Data;

      await controller.handleRequest(user, message, isReadOnly);
    }
  }
};

const hpc = new HotPocket.Contract();
hpc.init(contract, HotPocket.clientProtocols.JSON, true);
