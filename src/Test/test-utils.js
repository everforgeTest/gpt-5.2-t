const HotPocket = require("hotpocket-js-client");

async function createClient() {
  const userKeyPair = await HotPocket.generateKeys();
  const client = await HotPocket.createClient(["wss://localhost:8081"], userKeyPair);
  const ok = await client.connect();
  if (!ok) throw new Error("Connection failed");
  return { client, userKeyPair };
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Assertion failed. Expected ${b} got ${a}`);
}

function assertSuccessResponse(res) {
  if (!res || typeof res !== "object" || !res.success) {
    throw new Error("Expected success response");
  }
}

function assertErrorResponse(res) {
  if (!res || typeof res !== "object" || !res.error) {
    throw new Error("Expected error response");
  }
}

async function submitJSONRead(client, payload) {
  const out = await client.submitContractReadRequest(JSON.stringify(payload));
  return JSON.parse(out);
}

async function submitJSONInput(client, payload) {
  await client.submitContractInput(JSON.stringify(payload));
}

module.exports = {
  createClient,
  assertEqual,
  assertSuccessResponse,
  assertErrorResponse,
  submitJSONRead,
  submitJSONInput
};
