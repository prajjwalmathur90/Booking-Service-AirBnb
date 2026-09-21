import { v4 as uuidv4 } from "uuid";

export function generateIdempotencyKey(): string {
  const key = uuidv4();
  return key;
}
