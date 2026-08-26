import { ObjectId } from "mongodb";

/**
 * Stricter than ObjectId.isValid alone, which accepts any 12-byte string
 * (including non-hex). Prefer 24-char hex for public route params.
 */
export function isValidObjectId(id: string | undefined | null): boolean {
  if (!id || typeof id !== "string") return false;
  if (!/^[a-f0-9]{24}$/i.test(id)) return false;
  return ObjectId.isValid(id);
}

export function toObjectId(id: string): ObjectId | null {
  if (!isValidObjectId(id)) return null;
  return new ObjectId(id);
}
