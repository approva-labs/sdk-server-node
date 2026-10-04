import {
  ApprovaServerConfigSchema,
  createServerConfig,
  type ApprovaServerConfig,
} from "../config/server.config.js";
import { HttpClient } from "../http/HttpClient.js";
import { SessionService } from "../sessions/SessionService.js";
import { AuthorizationService } from "../authorization/AuthorizationService.js";
import { LocalSessionService } from "../sessions/LocalSessionService.js";
import { DeviceService } from "../devices/DeviceService.js";
import { WebAuthnService } from "../webauthn/WebAuthnService.js";
import type { StorageAdapter } from "../storage/StorageAdapter.js";
import { MemoryStorageAdapter } from "../storage/MemoryStorageAdapter.js";
import { SessionRepository } from "../sessions/SessionRepository.js";
import { z } from "zod";

const RelyingPartySchema = z.object({
  name: z.string().min(1),
  id: z.string().min(1), // registrable domain, e.g. "approva"
  origin: z.string().url(), // e.g. "https://approva.io"
});

export const ApprovaServerFullConfigSchema = ApprovaServerConfigSchema.extend({
  rp: RelyingPartySchema,
});

export type RelyingPartyConfig = z.infer<typeof RelyingPartySchema>;

export type ApprovaServerFullConfig = ApprovaServerConfig & {
  rp: RelyingPartyConfig;
};

export interface ApprovaServerOptions extends ApprovaServerConfig {
  rp: z.input<typeof RelyingPartySchema>;
  /** Defaults to an in-memory adapter — pass your own for production. */
  storage?: StorageAdapter;
}

export class ApprovaServer {
  readonly sessions: SessionService; // remote — Approva-hosted authorization sessions
  readonly authorization: AuthorizationService; // remote — blockchain authorization requests
  readonly devices: DeviceService; // local — trusted device registry
  readonly webauthn: WebAuthnService; // local — WebAuthn ceremonies
  readonly localSessions: LocalSessionService; // local — merchant-backend sessions

  constructor(options: ApprovaServerOptions) {
    const config = createServerConfig(options);
    const rp = RelyingPartySchema.parse(options.rp);
    const storage = options.storage ?? new MemoryStorageAdapter();

    const http = new HttpClient({
      baseUrl: config.apiUrl,
      timeoutMs: config.requestTimeoutMs,
    });

    this.authorization = new AuthorizationService(http);

    this.devices = new DeviceService(storage);
    this.webauthn = new WebAuthnService(
      { rpName: rp.name, rpID: rp.id, origin: rp.origin },
      storage,
      this.devices
    );

    this.localSessions = new LocalSessionService(storage);

    const sessionRepository = new SessionRepository(storage);

    this.sessions = new SessionService(
      sessionRepository,
      this.webauthn,
      this.devices
    );
  }
}
