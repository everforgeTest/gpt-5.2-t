const HotPocket = require("hotpocket-js-client");
const bson = require("bson");
const crypto = require("crypto");

class ContractService {
  userKeyPair = null;
  client = null;
  isConnectionSucceeded = false;
  servers = null;

  promiseMap = new Map();

  constructor(servers) {
    this.servers = servers;
  }

  async init() {
    if (this.userKeyPair == null) {
      this.userKeyPair = await HotPocket.generateKeys();
    }

    if (this.client == null) {
      this.client = await HotPocket.createClient(this.servers, this.userKeyPair, {
        protocol: HotPocket.protocols.bson
      });
    }

    this.client.on(HotPocket.events.disconnect, () => {
      this.isConnectionSucceeded = false;
    });

    this.client.on(HotPocket.events.contractOutput, r => {
      r.outputs.forEach(o => {
        const output = bson.deserialize(o);
        const pId = output.promiseId;
        const entry = this.promiseMap.get(pId);
        if (!entry) return;
        if (output.error) entry.rejecter(output.error);
        else entry.resolver(output.success);
        this.promiseMap.delete(pId);
      });
    });

    if (!this.isConnectionSucceeded) {
      if (!(await this.client.connect())) return false;
      this.isConnectionSucceeded = true;
    }

    return true;
  }

  async sign(buffer) {
    // HotPocket client uses Ed25519 keys and provides signing.
    return this.client.sign(buffer);
  }

  submitInputToContract(inp) {
    const promiseId = crypto.randomBytes(10).toString("hex");
    const inpBuf = bson.serialize({ promiseId: promiseId, ...inp });

    this.client.submitContractInput(inpBuf).then(input => {
      input && input.submissionStatus && input.submissionStatus.then(s => {
        if (s.status !== "accepted") {
          throw `Ledger_Rejection: ${s.reason}`;
        }
      });
    });

    return new Promise((resolve, reject) => {
      this.promiseMap.set(promiseId, { resolver: resolve, rejecter: reject });
    });
  }
}

module.exports = ContractService;
