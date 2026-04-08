const { assertEqual, assertSuccessResponse, assertErrorResponse, submitJSONRead, submitJSONInput } = require("../test-utils");

async function run(client, adminPubKey) {
  // Init token (caller becomes ADMIN)
  await submitJSONInput(client, {
    Service: "Token",
    Action: "Init",
    data: { name: "DemoToken", symbol: "DMT", decimals: 6 }
  });

  let info = await submitJSONRead(client, { Service: "Token", Action: "GetTokenInfo" });
  assertSuccessResponse(info);
  assertEqual(info.success.initialized, true, "Token should be initialized");

  // Grant MINTER to self
  await submitJSONInput(client, { Service: "Access", Action: "GrantRole", data: { targetPubKey: adminPubKey, role: "MINTER" } });

  // Mint to self
  await submitJSONInput(client, { Service: "Token", Action: "Mint", data: { toPubKey: adminPubKey, amount: "1000" } });

  let bal = await submitJSONRead(client, { Service: "Token", Action: "GetBalance", data: { pubKey: adminPubKey } });
  assertSuccessResponse(bal);
  assertEqual(bal.success.balance, "1000", "Balance should be 1000");

  // Pause
  await submitJSONInput(client, { Service: "Token", Action: "Pause" });

  // Transfer should fail while paused
  try {
    await submitJSONInput(client, { Service: "Token", Action: "Transfer", data: { toPubKey: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", amount: "1" } });
  } catch (_) {}

  const paused = await submitJSONRead(client, { Service: "Token", Action: "GetPauseStatus" });
  assertSuccessResponse(paused);
  assertEqual(paused.success.isPaused, true, "Contract should be paused");

  // Unpause
  await submitJSONInput(client, { Service: "Token", Action: "Unpause" });

  const unpaused = await submitJSONRead(client, { Service: "Token", Action: "GetPauseStatus" });
  assertSuccessResponse(unpaused);
  assertEqual(unpaused.success.isPaused, false, "Contract should be unpaused");

  // Total supply
  const supply = await submitJSONRead(client, { Service: "Token", Action: "GetTotalSupply" });
  assertSuccessResponse(supply);
  assertEqual(supply.success.totalSupply, "1000", "Total supply should be 1000");

  // Error scenario: transfer too much
  await submitJSONInput(client, { Service: "Token", Action: "Transfer", data: { toPubKey: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", amount: "999999" } });
  const bal2 = await submitJSONRead(client, { Service: "Token", Action: "GetBalance", data: { pubKey: adminPubKey } });
  // Depending on HP delivery timing, above may be accepted and then rejected internally; we assert balance unchanged.
  assertSuccessResponse(bal2);
  assertEqual(bal2.success.balance, "1000", "Balance should remain 1000 after failed transfer");

  return true;
}

module.exports = { run };
