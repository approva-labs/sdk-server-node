export { ApprovaServer } from "./client/ApprovaServer.js";

export {
  createServerConfig,
  ApprovaServerConfigSchema,
  ServerEnvironmentSchema,
} from "./config/server.config.js";

export type {
  ApprovaServerConfig,
  ResolvedApprovaServerConfig,
  ServerEnvironment,
} from "./config/server.config.js";

export { ApprovaServerError } from "./errors/ApprovaServerError.js";

export { SessionService } from "./sessions/SessionService.js";

export type {
  ApprovaSession,
  CreateSessionInput,
  SessionStatus,
  StoredSession,
} from "./sessions/types.js";

export type {
  WebAuthnConfig,
  WebAuthnContext,
  WebAuthnRegistrationStartInput,
  WebAuthnRegistrationFinishInput,
  WebAuthnAuthenticationStartInput,
  WebAuthnAuthenticationFinishInput,
} from "./webauthn/types.js";

export { AuthorizationService } from "./authorization/AuthorizationService.js";

export type {
  AuthorizationRequest,
  AuthorizationResponse,
  AuthorizationRequestStatus,
  // CreateAuthorizationRequestInput,
} from "./authorization/types.js";

export { TransactionService } from "./transactions/TransactionService.js";

export type {
  BaseTransaction,
  CreateTransactionInput,
  TransactionResult,
} from "./transactions/types.js";

export { ApprovaEventEmitter } from "./events/EventEmitter.js";

export type { ApprovaEvent } from "./events/types.js";

export { BaseAdapter } from "./adapters/base/BaseAdapter.js";

// export type {
//   BaseProvider,
//   BaseTransactionRequest,
//   BaseSignedTransaction,
//   BaseTransactionReceipt,
// } from "./adapters/index.js";
