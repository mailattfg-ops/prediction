import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.SEED_ADMIN_NAME || "Super Admin";
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "SUPER_ADMIN" },
    update: {},
  });
  console.log(`Seeded SUPER_ADMIN ${email}`);

  if ((await prisma.match.count()) === 0) {
    const kickoffAt = new Date(Date.now() + 2 * 60 * 60_000);
    await prisma.match.create({
      data: { homeTeam: "Arsenal", awayTeam: "Chelsea", competition: "Premier League", kickoffAt, venue: "Emirates Stadium" },
    });
    console.log("Seeded demo match Arsenal vs Chelsea (create a session for it in the admin UI)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
