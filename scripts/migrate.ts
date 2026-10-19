import { createDb } from "../src/server/db/create";

await createDb({ migrate: true });
console.log(JSON.stringify({ level: "info", msg: "migrations applied" }));
process.exit(0);
