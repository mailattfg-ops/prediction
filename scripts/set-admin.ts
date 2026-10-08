import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Create or update an admin login.
 *   npm run admin:set -- <email> <password> [name] [SUPER_ADMIN|ADMIN] [--replace old@email]
 * --replace renames an existing account (keeps its audit history) instead of creating a second one.
 */
const args = process.argv.slice(2);
const replaceIdx = args.indexOf("--replace");
const replaceEmail = replaceIdx >= 0 ? args[replaceIdx + 1]?.toLowerCase() : undefined;
const positional = replaceIdx >= 0 ? [...args.slice(0, replaceIdx), ...args.slice(replaceIdx + 2)] : args;
const [emailArg, password, name = "Admin", roleArg = "SUPER_ADMIN"] = positional;
const email = emailArg?.toLowerCase();

if (!email || !password) {
  console.error("Usage: npm run admin:set -- <email> <password> [name] [SUPER_ADMIN|ADMIN] [--replace old@email]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}
const role: Role = roleArg === "ADMIN" ? "ADMIN" : "SUPER_ADMIN";
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  const old = replaceEmail && replaceEmail !== email ? await prisma.adminUser.findUnique({ where: { email: replaceEmail } }) : null;

  if (old && !existing) {
    await prisma.adminUser.update({ where: { id: old.id }, data: { email, name, passwordHash, role } });
    console.log(`Renamed ${replaceEmail} to ${email} (${role}) and set the new password.`);
  } else {
    await prisma.adminUser.upsert({ where: { email }, create: { email, name, passwordHash, role }, update: { name, passwordHash, role } });
    console.log(`${existing ? "Updated" : "Created"} ${role} ${email}.`);
    if (old) {
      await prisma.adminUser.delete({ where: { id: old.id } });
      console.log(`Removed ${replaceEmail}.`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
