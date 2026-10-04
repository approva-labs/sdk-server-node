// file: src/devices/DeviceService.ts
import { randomUUID } from "node:crypto";

import type { StorageAdapter } from "../storage/StorageAdapter.js";
import type { TrustedDevice } from "./types.js";

function deviceKey(appId: string, deviceId: string): string {
  return `device:${appId}:${deviceId}`;
}

function deviceIndexPrefix(appId: string, userId: string): string {
  return `device:${appId}:user:${userId}:`;
}

export class DeviceService {
  constructor(private readonly storage: StorageAdapter) {}

  async register(input: {
    appId: string;
    userId: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports?: TrustedDevice["transports"];
    name?: string;
  }): Promise<TrustedDevice> {
    const device: TrustedDevice = {
      id: randomUUID(),
      appId: input.appId,
      userId: input.userId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: input.counter,
      transports: input.transports,
      name: input.name,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await this.storage.set(deviceKey(input.appId, device.id), device);

    // Secondary index so we can look devices up by credentialId during auth.
    await this.storage.set(
      `device:${input.appId}:credential:${input.credentialId}`,
      device.id
    );

    // Secondary index for "list devices for this user".
    await this.storage.set(
      `${deviceIndexPrefix(input.appId, input.userId)}${device.id}`,
      device.id
    );

    return device;
  }

  async getById(
    appId: string,
    deviceId: string
  ): Promise<TrustedDevice | null> {
    return this.storage.get<TrustedDevice>(deviceKey(appId, deviceId));
  }

  async getByCredentialId(
    appId: string,
    credentialId: string
  ): Promise<TrustedDevice | null> {
    const deviceId = await this.storage.get<string>(
      `device:${appId}:credential:${credentialId}`
    );

    if (!deviceId) return null;

    return this.getById(appId, deviceId);
  }

  async listForUser(appId: string, userId: string): Promise<TrustedDevice[]> {
    const deviceIds = await this.storage.list<string>(
      deviceIndexPrefix(appId, userId)
    );

    const devices = await Promise.all(
      deviceIds.map((id) => this.getById(appId, id))
    );

    return devices.filter((d): d is TrustedDevice => d !== null);
  }

  async updateCounter(
    appId: string,
    deviceId: string,
    counter: number
  ): Promise<void> {
    const device = await this.getById(appId, deviceId);
    if (!device) return;

    device.counter = counter;
    device.lastUsedAt = new Date().toISOString();

    await this.storage.set(deviceKey(appId, deviceId), device);
  }

  async revoke(appId: string, deviceId: string): Promise<void> {
    const device = await this.getById(appId, deviceId);
    if (!device) return;

    device.status = "revoked";

    await this.storage.set(deviceKey(appId, deviceId), device);
  }
}
