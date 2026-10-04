// file: src/devices/types.ts
export type DeviceStatus = "active" | "revoked";

export interface TrustedDevice {
  id: string;
  appId: string;
  userId: string;

  /** Base64url WebAuthn credential ID. */
  credentialId: string;

  /** Base64url COSE public key, as returned by SimpleWebAuthn. */
  publicKey: string;

  /** Signature counter — used to detect cloned authenticators. */
  counter: number;

  transports?: AuthenticatorTransportFuture[];

  /** User-facing label, e.g. "Samuel's iPhone". */
  name?: string;

  status: DeviceStatus;

  createdAt: string;
  lastUsedAt?: string;
}

// Re-declared locally so this file has no hard dependency on DOM lib types.
export type AuthenticatorTransportFuture =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";
