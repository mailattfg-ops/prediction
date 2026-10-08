import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Admin";

  if (email && password) {
    if (password.length < 8) throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    await prisma.adminUser.upsert({
      where: { email },
      create: { email, name, passwordHash, role: "SUPER_ADMIN" },
      update: {}, // never overwrite an existing account's password from the seed
    });
    console.log(existing ? `SUPER_ADMIN ${email} already exists (unchanged).` : `Seeded SUPER_ADMIN ${email}.`);
  } else {
    // Never create an account with a default password: without SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD
    // the seed leaves admins alone (use `npm run admin:set` instead).
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: no admin account seeded.");
  }

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
