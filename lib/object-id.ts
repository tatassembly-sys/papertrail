import { ObjectId } from "mongodb";

/**
 * Public route params must be 24-char hex. MongoDB 6+ ObjectId.isValid already
 * rejects many 12-byte ASCII strings; the hex check still blocks anything else
 * the driver might accept (padded values, 12-byte buffers as strings).
 */
export function isValidObjectId(id: string | undefined | null): boolean {
  if (!id || typeof id !== "string") return false;
  if (!/^[a-f0-9]{24}$/i.test(id)) return false;
  return ObjectId.isValid(id);
}
