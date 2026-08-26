import bcrypt from "bcryptjs";

/** Dummy hash so a missing-email path still spends a bcrypt compare (timing). */
const DUMMY_HASH = bcrypt.hashSync("timing-pad", 10);

/** Node-only password verification; this avoids bundling bcryptjs into Edge middleware. */
export function verifyAdminCredentials(email: string, password: string): boolean {
  // Support both the original application names and the deployment guide's
  // username terminology. The value is still treated as an email/login ID.
  const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) {
    throw new Error("ADMIN_EMAIL (or ADMIN_USERNAME) / ADMIN_PASSWORD_HASH are not set.");
  }

  const emailMatch =
    email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
  const hash = emailMatch ? adminPasswordHash : DUMMY_HASH;
  try {
    return bcrypt.compareSync(password, hash) && emailMatch;
  } catch {
    return false;
  }
}
