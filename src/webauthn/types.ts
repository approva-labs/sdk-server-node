// file: src/webauthn/types.ts

import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

/**
 * WebAuthn relying-party configuration.
 */
export interface WebAuthnConfig {
  /**
   * Human-readable relying-party name.
   * Example: "Approva"
   */
  rpName: string;

  /**
   * Registrable domain used as the RP ID.
   * Example: "approva.io"
   *
   * Must not contain a protocol, path, or port.
   */
  rpID: string;

  /**
   * Full origin expected from the WebAuthn client.
   * Example: "https://approva.io"
   */
  origin: string;
}

/**
 * Common context shared by WebAuthn operations.
 */
export interface WebAuthnContext {
  appId: string;
}

/**
 * Context for operations associated with a specific user.
 */
export interface WebAuthnUserContext extends WebAuthnContext {
  userId: string;
}

/**
 * Input required to start WebAuthn registration.
 */
export interface WebAuthnRegistrationStartInput extends WebAuthnUserContext {
  userName: string;
  deviceName?: string;
}

/**
 * Input required to complete WebAuthn registration.
 */
export interface WebAuthnRegistrationFinishInput extends WebAuthnUserContext {
  response: RegistrationResponseJSON;
  deviceName?: string;
}

/**
 * Input required to start WebAuthn authentication
 * for an existing Approva session.
 *
 * userId is optional to support discoverable
 * credentials/passkeys.
 */
export interface WebAuthnAuthenticationStartInput extends WebAuthnContext {
  sessionId: string;
  userId?: string;
  deviceId: string;
}

/**
 * Input required to complete WebAuthn authentication
 * for an existing Approva session.
 */
export interface WebAuthnAuthenticationFinishInput extends WebAuthnContext {
  sessionId: string;
  response: AuthenticationResponseJSON;
}
