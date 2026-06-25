const fs = require("fs");
const path = require("path");

const schemaContent = process.env.PRISMA_SCHEMA;
const targetPath = path.resolve(__dirname, "../prisma/schema.prisma");

if (schemaContent) {
  console.log("[write-schema] Found PRISMA_SCHEMA env variable, writing to:", targetPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, schemaContent, "utf8");
  console.log("[write-schema] Schema successfully written.");
} else {
  console.log("[write-schema] No PRISMA_SCHEMA env variable found. Using local schema file (if present).");
}
