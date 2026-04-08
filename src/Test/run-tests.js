const HotPocket = require("hotpocket-js-client");
const { createClient } = require("./test-utils");
const { run: tokenLifecycle } = require("./TestCases/TokenLifecycleTest");

async function main() {
  const { client, userKeyPair } = await createClient();
  const adminPubKey = Buffer.from(userKeyPair.publicKey).toString("hex");

  try {
    await tokenLifecycle(client, adminPubKey);
    console.log("All tests passed.");
  } catch (e) {
    console.error("Tests failed:", e);
    process.exitCode = 1;
  } finally {
    try { client.close(); } catch (_) {}
  }
}

main();
