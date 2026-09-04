const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "static-site");
const dest = path.join(__dirname, "_site");

if (fs.existsSync(src)) {
  fs.cpSync(src, dest, { recursive: true });
  console.log("Copied static-site/ into _site/");
} else {
  console.log("No static-site/ folder found — skipping.");
}