import fs from "node:fs";
import path from "node:path";
const file = path.join(process.cwd(), "data", "tekenergy.db");
for (const candidate of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
console.log("Demo database removed. Run pnpm db:seed to create it again.");
