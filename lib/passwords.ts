export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 72;

/** Small bundled list. Compared case-insensitively. */
export const COMMON_PASSWORDS = [
  "password",
  "password1",
  "password12",
  "password123",
  "1234567890",
  "123456789",
  "qwertyuiop",
  "qwerty123",
  "iloveyou1",
  "admin12345",
  "letmein123",
  "welcome123",
  "changeme123",
  "papertrail",
  "papertrail1",
  "abcdefghij",
  "1111111111",
  "0000000000",
  "passw0rd12",
  "trustno1ab",
] as const;

const COMMON = new Set<string>(COMMON_PASSWORDS);

export function passwordPolicyError(password: string): string | null {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return `Use a password between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (COMMON.has(password.toLowerCase())) {
    return "That password is too common. Choose another.";
  }
  return null;
}
