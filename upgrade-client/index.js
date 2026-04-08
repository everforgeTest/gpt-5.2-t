const fs = require("fs");
const path = require("path");
const ContractService = require("./contract-service");

// Run as:
// node index.js <contractUrl> <zipFilePath> <version> <description>

const contractUrl = process.argv[2];
const filepath = process.argv[3];
const version = process.argv[4];
const description = process.argv[5] || "";

async function main() {
  if (!contractUrl || !filepath || !version) {
    console.log("Usage: node index.js <contractUrl> <zipFilePath> <version> <description>");
    process.exit(1);
  }

  const fileName = path.basename(filepath);
  const zipBuffer = fs.readFileSync(filepath);
  const sizeKB = Math.round(zipBuffer.length / 1024);

  const svc = new ContractService([contractUrl]);
  const ok = await svc.init();
  if (!ok) {
    console.log("Connection failed.");
    process.exit(1);
  }

  const sig = await svc.sign(zipBuffer); // Ed25519 detached signature (hex)
  const sigHex = Buffer.from(sig).toString("hex");

  const payload = {
    Service: "Upgrade",
    Action: "UpgradeContract",
    data: {
      version: parseFloat(version),
      description: description,
      zipBase64: zipBuffer.toString("base64"),
      zipSignatureHex: sigHex
    }
  };

  console.log(`Uploading ${fileName} (${sizeKB}KB) version=${version}`);

  try {
    const res = await svc.submitInputToContract(payload);
    console.log("Upgrade submitted:", res);
  } catch (e) {
    console.log("Upgrade failed:", e);
  } finally {
    process.exit(0);
  }
}

main();
