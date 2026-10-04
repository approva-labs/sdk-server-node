// file: src/errors/isApprovaErrorCode.ts

import { ApprovaErrorCode } from "./ApprovaErrorCode.js";

export function isApprovaErrorCode(value: unknown): value is ApprovaErrorCode {
  if (typeof value !== "string") {
    return false;
  }

  return Object.values(ApprovaErrorCode).includes(value as ApprovaErrorCode);
}
