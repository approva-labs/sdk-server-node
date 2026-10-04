import { z } from "zod";

export const ServerEnvironmentSchema = z.enum([
  "development",
  "staging",
  "production",
]);

export type ServerEnvironment = z.infer<typeof ServerEnvironmentSchema>;

export const ApprovaServerConfigSchema = z.object({
  /**
   * Public application identifier.
   */
  appId: z.string().min(1, "appId is required"),

  /**
   * Approva API URL.
   */
  apiUrl: z.string().url("apiUrl must be a valid URL"),

  /**
   * Network used by the application.
   *
   * Approva currently targets Base.
   */
  network: z.literal("base").default("base"),

  /**
   * Optional Base RPC URL.
   */
  rpcUrl: z.string().url().optional(),

  /**
   * Server request timeout.
   */
  requestTimeoutMs: z.number().int().positive().default(15_000),

  /**
   * Number of transient request retries.
   */
  maxRetries: z.number().int().min(0).max(5).default(2),

  environment: ServerEnvironmentSchema.default("development"),
});

export type ApprovaServerConfig = z.input<typeof ApprovaServerConfigSchema>;

export type ResolvedApprovaServerConfig = z.output<
  typeof ApprovaServerConfigSchema
>;

export function createServerConfig(
  config: ApprovaServerConfig
): ResolvedApprovaServerConfig {
  const result = ApprovaServerConfigSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid Approva Server SDK configuration:\n${errors}`);
  }

  return result.data;
}

export function deriveWebSocketUrl(apiUrl: string): string {
  const url = new URL(apiUrl);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  url.pathname = "/ws";
  url.search = "";

  return url.toString().replace(/\/$/, "");
}
