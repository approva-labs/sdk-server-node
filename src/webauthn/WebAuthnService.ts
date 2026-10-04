// file: src/webauthn/WebAuthnService.ts

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";

import type { StorageAdapter } from "../storage/StorageAdapter.js";
import type { DeviceService } from "../devices/DeviceService.js";
import { ApprovaServerError } from "../errors/ApprovaServerError.js";
import type {
  WebAuthnConfig,
  WebAuthnRegistrationStartInput,
  WebAuthnRegistrationFinishInput,
  WebAuthnAuthenticationStartInput,
  WebAuthnAuthenticationFinishInput,
} from "./types.js";
import type { TrustedDevice } from "../devices/types.js";
import { ApprovaErrorCode } from "../errors/ApprovaErrorCode.js";
import { ApprovaErrors } from "../errors/ApprovaErrors.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function registrationChallengeKey(appId: string, userId: string): string {
  return `webauthn:challenge:registration:${appId}:${userId}`;
}

function authenticationChallengeKey(sessionId: string): string {
  return `webauthn:challenge:authentication:${sessionId}`;
}

export class WebAuthnService {
  constructor(
    private readonly config: WebAuthnConfig,
    private readonly storage: StorageAdapter,
    private readonly devices: DeviceService
  ) {}

  /**
   * Step 1:
   * Generate WebAuthn registration options for a user.
   */
  async beginRegistration(
    input: WebAuthnRegistrationStartInput
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    if (!input.appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId",
      });
    }

    if (!input.deviceName?.trim()) {
      throw ApprovaErrors.invalidRequest("A deviceName is required.", {
        field: "deviceId",
      });
    }

    let existingDevices: TrustedDevice[];
    const userHandle = crypto.randomUUID();

    try {
      existingDevices = await this.devices.listForUser(
        input.appId,
        input.userId
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to retrieve the user's registered devices.",
        code: ApprovaErrorCode.DEVICE_NOT_FOUND,
        status: 500,
        details: {
          appId: input.appId,
          userId: input.userId,
        },
        cause: error,
      });
    }

    let options: PublicKeyCredentialCreationOptionsJSON;
    console.log("lets begin");

    try {
      options = await generateRegistrationOptions({
        rpName: this.config.rpName,
        rpID: this.config.rpID,

        userID: new TextEncoder().encode(userHandle),

        userName: input.userName,
        userDisplayName: "Approva User",
        attestationType: "none",

        excludeCredentials: existingDevices
          .filter((device) => device.status === "active")
          .map((device) => ({
            id: device.credentialId,
            transports: device.transports,
          })),

        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      });

      console.log({ options });
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to generate the WebAuthn registration challenge.",
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_FAILED,
        status: 500,
        cause: error,
      });
    }

    try {
      await this.storage.set(
        registrationChallengeKey(input.appId, input.userId),
        options.challenge,
        CHALLENGE_TTL_MS
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to store the WebAuthn registration challenge.",
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_FAILED,
        status: 500,
        cause: error,
      });
    }

    return options;
  }

  /**
   * Step 2:
   * Verify WebAuthn registration and register the device.
   */
  async finishRegistration(
    input: WebAuthnRegistrationFinishInput
  ): Promise<TrustedDevice> {
    if (!input.appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId",
      });
    }

    if (!input.userId?.trim()) {
      throw ApprovaErrors.invalidRequest("A user ID is required.", {
        field: "userId",
      });
    }

    if (!input.response) {
      throw ApprovaErrors.invalidRequest(
        "A WebAuthn registration response is required.",
        {
          field: "response",
        }
      );
    }

    let expectedChallenge: string | null;

    try {
      expectedChallenge = await this.storage.get<string>(
        registrationChallengeKey(input.appId, input.userId)
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to retrieve the WebAuthn registration challenge.",
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_FAILED,
        status: 500,
        cause: error,
      });
    }

    if (!expectedChallenge) {
      throw new ApprovaServerError({
        message:
          "The WebAuthn registration challenge has expired or could not be found.",
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_MISSING,
        status: 410,
        details: {
          appId: input.appId,
          userId: input.userId,
        },
      });
    }

    let verification: VerifiedRegistrationResponse;

    try {
      verification = await verifyRegistrationResponse({
        response: input.response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpID,
      });
    } catch (error) {
      throw new ApprovaServerError({
        message: "WebAuthn registration verification failed.",
        code: ApprovaErrorCode.WEBAUTHN_VERIFICATION_FAILED,
        status: 401,
        details: {
          appId: input.appId,
          userId: input.userId,
        },
        cause: error,
      });
    }

    try {
      await this.storage.delete(
        registrationChallengeKey(input.appId, input.userId)
      );
    } catch (error) {
      throw new ApprovaServerError({
        message:
          "Failed to remove the consumed WebAuthn registration challenge.",
        code: ApprovaErrorCode.INTERNAL_ERROR,
        status: 500,
        cause: error,
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new ApprovaServerError({
        message: "WebAuthn registration could not be verified.",
        code: ApprovaErrorCode.WEBAUTHN_NOT_VERIFIED,
        status: 401,
        details: {
          appId: input.appId,
          userId: input.userId,
        },
      });
    }

    const { credential } = verification.registrationInfo;

    if (!credential?.id || !credential.publicKey) {
      throw new ApprovaServerError({
        message:
          "The WebAuthn registration did not contain a valid credential.",
        code: ApprovaErrorCode.WEBAUTHN_CREDENTIAL_INVALID,
        status: 401,
      });
    }

    try {
      return await this.devices.register({
        appId: input.appId,
        userId: input.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports,
        name: input.deviceName,
      });
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to register the trusted device.",
        code: ApprovaErrorCode.DEVICE_REGISTRATION_FAILED,
        status: 500,
        details: {
          appId: input.appId,
          userId: input.userId,
        },
        cause: error,
      });
    }
  }

  /**
   * Step 1:
   * Generate authentication options for an
   * existing Approva session.
   *
   * The authentication challenge is stored against
   * sessionId so multiple authentication requests
   * for the same user cannot overwrite each other's
   * challenges.
   *
   * userId is optional because discoverable
   * credentials/passkeys can be used.
   */
  async beginAuthentication(
    input: WebAuthnAuthenticationStartInput
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    if (!input.appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId",
      });
    }

    if (!input.sessionId?.trim()) {
      throw ApprovaErrors.invalidRequest("A session ID is required.", {
        field: "sessionId",
      });
    }

    if (!input.deviceId?.trim()) {
      throw ApprovaErrors.invalidRequest("A device ID is required.", {
        field: "sessionId",
      });
    }

    let activeDevices: TrustedDevice[] = [];

    if (input.userId) {
      let devices: TrustedDevice[];

      try {
        devices = await this.devices.listForUser(input.appId, input.userId);
      } catch (error) {
        throw new ApprovaServerError({
          message: "Failed to retrieve the user's trusted devices.",
          code: ApprovaErrorCode.DEVICE_NOT_FOUND,
          status: 500,
          details: {
            appId: input.appId,
            userId: input.userId,
          },
          cause: error,
        });
      }

      activeDevices = devices.filter((device) => device.status === "active");
    }

    let options: PublicKeyCredentialRequestOptionsJSON;

    try {
      options = await generateAuthenticationOptions({
        rpID: this.config.rpID,

        userVerification: "required",

        ...(activeDevices.length > 0
          ? {
              allowCredentials: activeDevices.map((device) => ({
                id: device.credentialId,
                transports: device.transports,
              })),
            }
          : {}),
      });
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to generate the WebAuthn authentication challenge.",
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_FAILED,
        status: 500,
        cause: error,
      });
    }

    try {
      await this.storage.set(
        authenticationChallengeKey(input.sessionId),
        options.challenge,
        CHALLENGE_TTL_MS
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to store the WebAuthn authentication challenge.",
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_FAILED,
        status: 500,
        cause: error,
      });
    }

    return options;
  }

  /**
   * Step 2:
   * Verify the WebAuthn authentication response
   * for an existing Approva session.
   *
   * This method proves that the registered device
   * authenticated successfully.
   *
   * Session state should be updated by the
   * session/authorization layer after this method
   * succeeds.
   */
  async finishAuthentication(
    input: WebAuthnAuthenticationFinishInput
  ): Promise<TrustedDevice> {
    if (!input.appId?.trim()) {
      throw ApprovaErrors.invalidRequest("An app ID is required.", {
        field: "appId",
      });
    }

    if (!input.sessionId?.trim()) {
      throw ApprovaErrors.invalidRequest("A session ID is required.", {
        field: "sessionId",
      });
    }

    if (!input.response) {
      throw ApprovaErrors.invalidRequest(
        "A WebAuthn authentication response is required.",
        {
          field: "response",
        }
      );
    }

    let expectedChallenge: string | null;

    try {
      expectedChallenge = await this.storage.get<string>(
        authenticationChallengeKey(input.sessionId)
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to retrieve the WebAuthn authentication challenge.",
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_FAILED,
        status: 500,
        cause: error,
      });
    }

    if (!expectedChallenge) {
      throw new ApprovaServerError({
        message:
          "The WebAuthn authentication challenge has expired or could not be found.",
        code: ApprovaErrorCode.WEBAUTHN_CHALLENGE_MISSING,
        status: 410,
        details: {
          appId: input.appId,
          sessionId: input.sessionId,
        },
      });
    }

    const response = input.response;

    if (!response.id) {
      throw new ApprovaServerError({
        message:
          "The WebAuthn authentication response does not contain a credential ID.",
        code: ApprovaErrorCode.WEBAUTHN_CREDENTIAL_INVALID,
        status: 400,
      });
    }

    let device: TrustedDevice | null;

    try {
      device = await this.devices.getByCredentialId(input.appId, response.id);
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to retrieve the WebAuthn device credential.",
        code: ApprovaErrorCode.DEVICE_NOT_FOUND,
        status: 500,
        cause: error,
      });
    }

    if (!device || device.status !== "active") {
      throw new ApprovaServerError({
        message:
          "The WebAuthn device credential is unknown or has been revoked.",
        code: ApprovaErrorCode.WEBAUTHN_UNKNOWN_DEVICE,
        status: 401,
        details: {
          credentialId: response.id,
        },
      });
    }

    let verification: VerifiedAuthenticationResponse;

    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpID,

        credential: {
          id: device.credentialId,
          publicKey: Buffer.from(device.publicKey, "base64url"),
          counter: device.counter,
          transports: device.transports,
        },
      });
    } catch (error) {
      throw new ApprovaServerError({
        message: "WebAuthn authentication verification failed.",
        code: ApprovaErrorCode.WEBAUTHN_VERIFICATION_FAILED,
        status: 401,
        details: {
          appId: input.appId,
          sessionId: input.sessionId,
          credentialId: response.id,
        },
        cause: error,
      });
    }

    if (!verification.verified) {
      throw new ApprovaServerError({
        message: "WebAuthn authentication could not be verified.",
        code: ApprovaErrorCode.WEBAUTHN_NOT_VERIFIED,
        status: 401,
        details: {
          appId: input.appId,
          sessionId: input.sessionId,
          credentialId: response.id,
        },
      });
    }

    /**
     * Consume the challenge only after successful
     * verification.
     */
    try {
      await this.storage.delete(authenticationChallengeKey(input.sessionId));
    } catch (error) {
      throw new ApprovaServerError({
        message:
          "Failed to remove the consumed WebAuthn authentication challenge.",
        code: ApprovaErrorCode.INTERNAL_ERROR,
        status: 500,
        cause: error,
      });
    }

    try {
      await this.devices.updateCounter(
        input.appId,
        device.id,
        verification.authenticationInfo.newCounter
      );
    } catch (error) {
      throw new ApprovaServerError({
        message: "Failed to update the WebAuthn credential counter.",
        code: ApprovaErrorCode.INTERNAL_ERROR,
        status: 500,
        details: {
          deviceId: device.id,
        },
        cause: error,
      });
    }

    return device;
  }
}
