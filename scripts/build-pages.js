const fs = require("fs");
const path = require("path");

const argUrl = process.argv.find((arg) => arg.startsWith("--url="));
const serverUrl = process.env.TYPERACER_SERVER_URL || (argUrl ? argUrl.slice(6) : "");

const publicDir = path.join(__dirname, "..", "public");
const docsDir = path.join(__dirname, "..", "docs");

fs.rmSync(docsDir, { recursive: true, force: true });
fs.mkdirSync(docsDir, { recursive: true });

for (const file of fs.readdirSync(publicDir)) {
  if (file === "config.js") continue;
  fs.copyFileSync(path.join(publicDir, file), path.join(docsDir, file));
}

fs.writeFileSync(
  path.join(docsDir, "config.js"),
  `window.TYPERACER_SERVER_URL = ${JSON.stringify(serverUrl)};\n`
);
fs.writeFileSync(path.join(docsDir, ".nojekyll"), "");

console.log("Built docs/ for GitHub Pages");
console.log("Backend URL:", serverUrl || "(not set — set TYPERACER_SERVER_URL)");
