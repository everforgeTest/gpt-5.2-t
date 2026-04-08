const nacl = require("tweetnacl");

function hexToU8(hex) {
  if (typeof hex !== "string") throw new Error("Hex value must be a string.");
  const h = hex.toLowerCase().startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-f]*$/.test(h) || h.length % 2 !== 0) throw new Error("Invalid hex string.");
  return new Uint8Array(Buffer.from(h, "hex"));
}

function verifyEd25519Detached(messageBuffer, signatureHex, publicKeyHex) {
  const msg = new Uint8Array(messageBuffer);
  const sig = hexToU8(signatureHex);
  const pk = hexToU8(publicKeyHex);
  if (sig.length !== nacl.sign.signatureLength) throw new Error("Invalid signature length.");
  if (pk.length !== nacl.sign.publicKeyLength) throw new Error("Invalid public key length.");
  return nacl.sign.detached.verify(msg, sig, pk);
}

module.exports = {
  hexToU8,
  verifyEd25519Detached
};
