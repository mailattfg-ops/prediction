import { processQueue } from "../src/lib/notifications/worker";
import { prisma } from "../src/lib/db";

// Long-running WhatsApp sender. Run with: npm run worker
let running = true;
const stop = () => {
  running = false;
  console.log("worker: stopping after current batch");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

async function main() {
  console.log("worker: started (dry-run =", process.env.WHATSAPP_DRY_RUN === "true", ")");
  while (running) {
    try {
      const r = await processQueue();
      if (r.processed) console.log(`worker: processed=${r.processed} sent=${r.sent} failed=${r.failed}`);
      else await new Promise((res) => setTimeout(res, 3000));
    } catch (e) {
      console.error("worker: batch error", e);
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  await prisma.$disconnect();
}

main();
