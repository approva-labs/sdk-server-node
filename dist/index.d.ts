import { z } from 'zod';
import { RegistrationResponseJSON, AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';

declare const ServerEnvironmentSchema: z.ZodEnum<["development", "staging", "production"]>;
type ServerEnvironment = z.infer<typeof ServerEnvironmentSchema>;
declare const ApprovaServerConfigSchema: z.ZodObject<{
    /**
     * Public application identifier.
     */
    appId: z.ZodString;
    /**
     * Approva API URL.
     */
    apiUrl: z.ZodString;
    /**
     * Network used by the application.
     *
     * Approva currently targets Base.
     */
    network: z.ZodDefault<z.ZodLiteral<"base">>;
    /**
     * Optional Base RPC URL.
     */
    rpcUrl: z.ZodOptional<z.ZodString>;
    /**
     * Server request timeout.
     */
    requestTimeoutMs: z.ZodDefault<z.ZodNumber>;
    /**
     * Number of transient request retries.
     */
    maxRetries: z.ZodDefault<z.ZodNumber>;
    environment: z.ZodDefault<z.ZodEnum<["development", "staging", "production"]>>;
}, "strip", z.ZodTypeAny, {
    appId: string;
    apiUrl: string;
    network: "base";
    requestTimeoutMs: number;
    maxRetries: number;
    environment: "development" | "staging" | "production";
    rpcUrl?: string | undefined;
}, {
    appId: string;
    apiUrl: string;
    network?: "base" | undefined;
    rpcUrl?: string | undefined;
    requestTimeoutMs?: number | undefined;
    maxRetries?: number | undefined;
    environment?: "development" | "staging" | "production" | undefined;
}>;
type ApprovaServerConfig = z.input<typeof ApprovaServerConfigSchema>;
type ResolvedApprovaServerConfig = z.output<typeof ApprovaServerConfigSchema>;
declare function createServerConfig(config: ApprovaServerConfig): ResolvedApprovaServerConfig;

interface StorageAdapter {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<void>;
    list<T>(prefix: string): Promise<T[]>;
}

type DeviceStatus = "active" | "revoked";
interface TrustedDevice {
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
type AuthenticatorTransportFuture = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

declare class DeviceService {
    private readonly storage;
    constructor(storage: StorageAdapter);
    register(input: {
        appId: string;
        userId: string;
        credentialId: string;
        publicKey: string;
        counter: number;
        transports?: TrustedDevice["transports"];
        name?: string;
    }): Promise<TrustedDevice>;
    getById(appId: string, deviceId: string): Promise<TrustedDevice | null>;
    getByCredentialId(appId: string, credentialId: string): Promise<TrustedDevice | null>;
    listForUser(appId: string, userId: string): Promise<TrustedDevice[]>;
    updateCounter(appId: string, deviceId: string, counter: number): Promise<void>;
    revoke(appId: string, deviceId: string): Promise<void>;
}

/**
 * WebAuthn relying-party configuration.
 */
interface WebAuthnConfig {
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
interface WebAuthnContext {
    appId: string;
}
/**
 * Context for operations associated with a specific user.
 */
interface WebAuthnUserContext extends WebAuthnContext {
    userId: string;
}
/**
 * Input required to start WebAuthn registration.
 */
interface WebAuthnRegistrationStartInput extends WebAuthnUserContext {
    userName: string;
    deviceName?: string;
}
/**
 * Input required to complete WebAuthn registration.
 */
interface WebAuthnRegistrationFinishInput extends WebAuthnUserContext {
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
interface WebAuthnAuthenticationStartInput extends WebAuthnContext {
    sessionId: string;
    userId?: string;
    deviceId: string;
}
/**
 * Input required to complete WebAuthn authentication
 * for an existing Approva session.
 */
interface WebAuthnAuthenticationFinishInput extends WebAuthnContext {
    sessionId: string;
    response: AuthenticationResponseJSON;
}

declare class WebAuthnService {
    private readonly config;
    private readonly storage;
    private readonly devices;
    constructor(config: WebAuthnConfig, storage: StorageAdapter, devices: DeviceService);
    /**
     * Step 1:
     * Generate WebAuthn registration options for a user.
     */
    beginRegistration(input: WebAuthnRegistrationStartInput): Promise<PublicKeyCredentialCreationOptionsJSON>;
    /**
     * Step 2:
     * Verify WebAuthn registration and register the device.
     */
    finishRegistration(input: WebAuthnRegistrationFinishInput): Promise<TrustedDevice>;
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
    beginAuthentication(input: WebAuthnAuthenticationStartInput): Promise<PublicKeyCredentialRequestOptionsJSON>;
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
    finishAuthentication(input: WebAuthnAuthenticationFinishInput): Promise<TrustedDevice>;
}

type SessionStatus = "PENDING" | "AUTHENTICATING" | "ACTIVE" | "EXPIRED" | "REVOKED" | "CANCELLED" | "FAILED";
interface CreateSessionInput {
    appId: string;
    userId?: string;
    /**
     * Browser/application origin.
     */
    origin: string;
    /**
     * Requested permissions for this session.
     */
    scopes: string[];
    /**
     * Optional session expiration.
     */
    expiresAt?: string;
    metadata?: Record<string, unknown>;
}
interface StoredSession {
    id: string;
    appId: string;
    userId?: string;
    origin: string;
    scopes: string[];
    status: SessionStatus;
    challenge?: string;
    deepLink: string;
    createdAt: string;
    expiresAt: string;
    deviceId?: string;
    metadata?: Record<string, unknown>;
}
interface ApprovaSession {
    id: string;
    appId: string;
    userId?: string;
    deviceId: string;
    origin: string;
    scopes: string[];
    status: SessionStatus;
    createdAt: string;
    expiresAt: string;
    metadata?: Record<string, unknown>;
}
interface ApprovaSession {
    id: string;
    appId: string;
    userId?: string;
    origin: string;
    scopes: string[];
    status: SessionStatus;
    deepLink: string;
    createdAt: string;
    expiresAt: string;
    deviceId: string;
    metadata?: Record<string, unknown>;
}
interface SessionResponse {
    sessionId: string;
    status: SessionStatus;
    session?: ApprovaSession;
}
interface CompleteSessionInput {
    credential: AuthenticationResponseJSON;
    sessionId: string;
}

interface CreateStoredSessionInput {
    id: string;
    appId: string;
    userId?: string;
    origin: string;
    scopes: string[];
    status: SessionStatus;
    challenge: string;
    deepLink: string;
    createdAt: Date;
    expiresAt: Date;
    deviceId?: string;
    metadata?: Record<string, unknown>;
}
interface UpdateSessionInput {
    status?: SessionStatus;
    deepLink?: string;
    deviceId?: string;
    metadata?: Record<string, unknown>;
}
declare class SessionRepository {
    private readonly storage;
    constructor(storage: StorageAdapter);
    create(input: CreateStoredSessionInput): Promise<StoredSession>;
    findById(appId: string, sessionId: string): Promise<StoredSession | null>;
    update(appId: string, sessionId: string, input: UpdateSessionInput): Promise<StoredSession | null>;
    activate(appId: string, sessionId: string, input: {
        deviceId: string;
    }): Promise<StoredSession | null>;
    delete(appId: string, sessionId: string): Promise<void>;
    list(appId: string): Promise<StoredSession[]>;
}

declare class SessionService {
    private readonly sessions;
    private readonly webauthn;
    private readonly devices;
    constructor(sessions: SessionRepository, webauthn: WebAuthnService, devices: DeviceService);
    /**
     * Creates a pending session.
     *
     * The user has NOT authenticated yet.
     *
     * Flow:
     *
     * create()
     *   ↓
     * WebAuthn challenge
     *   ↓
     * pending session
     *   ↓
     * deep link
     *   ↓
     * frontend SDK
     */
    create(appId: string, input: CreateSessionInput): Promise<ApprovaSession>;
    createAnonymousUserId(): string;
    /**
     * Gets a session.
     */
    get(appId: string, sessionId: string): Promise<ApprovaSession>;
    /**
     * Returns the current session establishment
     * result.
     */
    getResponse(appId: string, sessionId: string): Promise<SessionResponse | any>;
    /**
     * Completes a pending session after the
     * frontend SDK has performed WebAuthn.
     */
    complete(appId: string, sessionId: string, input: CompleteSessionInput): Promise<ApprovaSession>;
    /**
     * Revokes an existing session.
     */
    revoke(appId: string, sessionId: string): Promise<void>;
    /**
     * Lists sessions belonging to an application.
     */
    list(appId: string): Promise<ApprovaSession[]>;
    private getStoredSession;
    private ensureSessionState;
    private validateAppId;
    private validateIdentifiers;
    private validateCreateInput;
    private resolveExpiration;
    private toPublicSession;
    private createDeepLink;
}

interface HttpClientOptions {
    baseUrl: string;
    serverKey?: string;
    timeoutMs: number;
}
declare class HttpClient {
    private readonly options;
    private readonly client;
    constructor(options: HttpClientOptions);
    get baseUrl(): string;
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    delete<T = void>(path: string): Promise<T>;
    private resolveUrl;
    private request;
    private toApprovaServerError;
    private handleAxiosError;
    private extractMessage;
    private extractErrorCode;
    private extractDetails;
}

type AuthorizationRequestStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";
interface CreateAuthorizationRequestInput {
    sessionId: string;
    /**
     * Human-readable action.
     */
    action: string;
    /**
     * What the user sees in Approva.
     */
    description: string;
    /**
     * Transaction information.
     */
    transaction?: {
        to: string;
        value?: string;
        data?: string;
    };
    /**
     * Chain-specific transaction metadata.
     */
    chain: {
        network: "base";
        chainId: number;
    };
    /**
     * Optional merchant metadata.
     */
    metadata?: Record<string, unknown>;
    expiresInSeconds?: number;
}
interface AuthorizationRequest {
    id: string;
    sessionId: string;
    status: AuthorizationRequestStatus;
    action: string;
    description: string;
    transaction?: {
        to: string;
        value?: string;
        data?: string;
    };
    chain: {
        network: "base";
        chainId: number;
    };
    createdAt: string;
    expiresAt: string;
}
interface AuthorizationResponse {
    requestId: string;
    status: "approved" | "rejected";
    signature?: string;
    signer?: string;
    transactionHash?: string;
    approvedAt?: string;
    rejectionReason?: string;
}

declare class AuthorizationService {
    private readonly http;
    constructor(http: HttpClient);
    create(input: CreateAuthorizationRequestInput): Promise<AuthorizationRequest>;
    get(requestId: string): Promise<AuthorizationRequest>;
    getResponse(requestId: string): Promise<AuthorizationResponse>;
    cancel(requestId: string): Promise<void>;
}

interface LocalSession {
    id: string;
    appId: string;
    userId: string;
    deviceId: string;
    createdAt: string;
    expiresAt: string;
}
/**
 * Local, backend-issued sessions — separate from Approva's hosted
 * SessionService (which manages blockchain-authorization sessions).
 * This is "is this browser the device that just passed WebAuthn."
 */
declare class LocalSessionService {
    private readonly storage;
    private readonly ttlMs;
    constructor(storage: StorageAdapter, ttlMs?: number);
    /** Call after WebAuthnService.finishAuthentication() succeeds. */
    create(input: {
        appId: string;
        userId: string;
        deviceId: string;
    }): Promise<{
        session: LocalSession;
        token: string;
    }>;
    /** Validate a token handed back by the browser (e.g. an Authorization header). */
    validate(appId: string, token: string): Promise<LocalSession | null>;
    revoke(appId: string, sessionId: string): Promise<void>;
}

declare const RelyingPartySchema: z.ZodObject<{
    name: z.ZodString;
    id: z.ZodString;
    origin: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    origin: string;
    name: string;
}, {
    id: string;
    origin: string;
    name: string;
}>;
interface ApprovaServerOptions extends ApprovaServerConfig {
    rp: z.input<typeof RelyingPartySchema>;
    /** Defaults to an in-memory adapter — pass your own for production. */
    storage?: StorageAdapter;
}
declare class ApprovaServer {
    readonly sessions: SessionService;
    readonly authorization: AuthorizationService;
    readonly devices: DeviceService;
    readonly webauthn: WebAuthnService;
    readonly localSessions: LocalSessionService;
    constructor(options: ApprovaServerOptions);
}

declare enum ApprovaErrorCode {
    UNKNOWN_ERROR = "APPROVA_UNKNOWN_ERROR",
    INVALID_REQUEST = "APPROVA_INVALID_REQUEST",
    UNAUTHORIZED = "APPROVA_UNAUTHORIZED",
    FORBIDDEN = "APPROVA_FORBIDDEN",
    NOT_FOUND = "APPROVA_NOT_FOUND",
    CONFLICT = "APPROVA_CONFLICT",
    RATE_LIMITED = "APPROVA_RATE_LIMITED",
    INTERNAL_ERROR = "APPROVA_INTERNAL_ERROR",
    SESSION_NOT_FOUND = "APPROVA_SESSION_NOT_FOUND",
    SESSION_EXPIRED = "APPROVA_SESSION_EXPIRED",
    SESSION_REVOKED = "APPROVA_SESSION_REVOKED",
    SESSION_CANCELLED = "APPROVA_SESSION_CANCELLED",
    SESSION_ALREADY_ACTIVE = "APPROVA_SESSION_ALREADY_ACTIVE",
    SESSION_INVALID_STATE = "APPROVA_SESSION_INVALID_STATE",
    SESSION_CREATION_FAILED = "APPROVA_SESSION_CREATION_FAILED",
    SESSION_COMPLETION_FAILED = "APPROVA_SESSION_COMPLETION_FAILED",
    DEVICE_NOT_FOUND = "APPROVA_DEVICE_NOT_FOUND",
    DEVICE_REVOKED = "APPROVA_DEVICE_REVOKED",
    DEVICE_REGISTRATION_FAILED = "APPROVA_DEVICE_REGISTRATION_FAILED",
    WEBAUTHN_CHALLENGE_FAILED = "APPROVA_WEBAUTHN_CHALLENGE_FAILED",
    WEBAUTHN_VERIFICATION_FAILED = "APPROVA_WEBAUTHN_VERIFICATION_FAILED",
    WEBAUTHN_CREDENTIAL_INVALID = "APPROVA_WEBAUTHN_CREDENTIAL_INVALID",
    WEBAUTHN_CHALLENGE_MISSING = "WEBAUTHN_CHALLENGE_MISSING",
    WEBAUTHN_NOT_VERIFIED = "WEBAUTHN_NOT_VERIFIED",
    WEBAUTHN_NO_DEVICES = "WEBAUTHN_NO_DEVICES",
    WEBAUTHN_UNKNOWN_DEVICE = "WEBAUTHN_UNKNOWN_DEVICE",
    AUTHORIZATION_NOT_FOUND = "APPROVA_AUTHORIZATION_NOT_FOUND",
    AUTHORIZATION_EXPIRED = "APPROVA_AUTHORIZATION_EXPIRED",
    AUTHORIZATION_REJECTED = "APPROVA_AUTHORIZATION_REJECTED",
    AUTHORIZATION_INVALID_STATE = "APPROVA_AUTHORIZATION_INVALID_STATE",
    API_UNAVAILABLE = "APPROVA_API_UNAVAILABLE",
    API_REQUEST_FAILED = "APPROVA_API_REQUEST_FAILED",
    API_RESPONSE_INVALID = "APPROVA_API_RESPONSE_INVALID",
    NETWORK_ERROR = "NETWORK_ERROR",
    HTTP_ERROR = "HTTP_ERROR",
    REQUEST_TIMEOUT = "REQUEST_TIMEOUT",
    DEVICE_LOOKUP_FAILED = "DEVICE_LOOKUP_FAILED",
    WEBAUTHN_INVALID_REQUEST = "WEBAUTHN_INVALID_REQUEST",
    WEBSOCKET_TIMEOUT = "WEBSOCKET_TIMEOUT",
    WEBSOCKET_CONNECTION_FAILED = "WEBSOCKET_CONNECTION_FAILED",
    WEBSOCKET_NOT_CONNECTED = "WEBSOCKET_NOT_CONNECTED",
    SESSION_INVALID_STATUS = "SESSION_INVALID_STATUS"
}

interface ApprovaServerErrorParams {
    message: string;
    code: ApprovaErrorCode;
    status?: number;
    details?: unknown;
    cause?: unknown;
}
declare class ApprovaServerError extends Error {
    readonly code: ApprovaErrorCode;
    readonly status?: number;
    readonly details?: unknown;
    constructor(params: ApprovaServerErrorParams);
    /**
     * Returns a safe, serializable representation
     * of the error.
     */
    toJSON(): {
        name: string;
        code: ApprovaErrorCode;
        message: string;
        status: number | undefined;
        details: unknown;
    };
    /**
     * Creates an ApprovaServerError from an unknown
     * thrown value.
     */
    static from(error: unknown, fallback?: {
        code?: ApprovaErrorCode;
        message?: string;
        status?: number;
    }): ApprovaServerError;
}

interface BaseTransaction {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: number;
    chainId: 8453;
}
interface CreateTransactionInput {
    sessionId: string;
    transaction: BaseTransaction;
    /**
     * Human-readable description presented to the user.
     */
    description: string;
    metadata?: Record<string, unknown>;
}
interface TransactionResult {
    requestId: string;
    status: "pending" | "approved" | "rejected" | "submitted" | "confirmed" | "failed";
    transactionHash?: string;
    signer?: string;
    signature?: string;
    blockNumber?: number;
}

declare class TransactionService {
    private readonly http;
    constructor(http: HttpClient);
    authorize(input: CreateTransactionInput): Promise<TransactionResult>;
    get(requestId: string): Promise<TransactionResult>;
    submit(requestId: string, signature: string): Promise<TransactionResult>;
}

type ApprovaEvent = {
    type: "session.created";
    sessionId: string;
} | {
    type: "session.connected";
    sessionId: string;
    deviceId: string;
} | {
    type: "session.revoked";
    sessionId: string;
} | {
    type: "authorization.created";
    requestId: string;
    sessionId: string;
} | {
    type: "authorization.approved";
    requestId: string;
    sessionId: string;
    signer?: string;
} | {
    type: "authorization.rejected";
    requestId: string;
    sessionId: string;
    reason?: string;
} | {
    type: "transaction.submitted";
    requestId: string;
    transactionHash: string;
} | {
    type: "transaction.confirmed";
    requestId: string;
    transactionHash: string;
} | {
    type: "transaction.failed";
    requestId: string;
    reason?: string;
};

type Listener<T extends ApprovaEvent> = (event: T) => void | Promise<void>;
declare class ApprovaEventEmitter {
    private listeners;
    on<T extends ApprovaEvent>(type: T["type"], listener: Listener<T>): () => void;
    emit(event: ApprovaEvent): Promise<void>;
    removeAllListeners(): void;
}

interface BaseTransactionRequest {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    nonce?: number;
    chainId: 8453;
}
interface BaseSignedTransaction {
    rawTransaction: string;
    signer: string;
}
interface BaseTransactionReceipt {
    transactionHash: string;
    blockNumber: number;
    status: "success" | "reverted";
}
interface BaseAdapter$1 {
    getChainId(): number;
    validateTransaction(transaction: BaseTransactionRequest): Promise<void>;
    submitTransaction(signedTransaction: BaseSignedTransaction): Promise<string>;
    waitForConfirmation(transactionHash: string): Promise<BaseTransactionReceipt>;
}

interface BaseProvider {
    send(method: string, params: unknown[]): Promise<unknown>;
}
declare class BaseAdapter implements BaseAdapter$1 {
    private readonly provider;
    readonly chainId = 8453;
    constructor(provider: BaseProvider);
    getChainId(): number;
    validateTransaction(transaction: BaseTransactionRequest): Promise<void>;
    submitTransaction(signedTransaction: BaseSignedTransaction): Promise<string>;
    waitForConfirmation(transactionHash: string): Promise<BaseTransactionReceipt>;
}

export { type ApprovaEvent, ApprovaEventEmitter, ApprovaServer, type ApprovaServerConfig, ApprovaServerConfigSchema, ApprovaServerError, type ApprovaSession, type AuthorizationRequest, type AuthorizationRequestStatus, type AuthorizationResponse, AuthorizationService, BaseAdapter, type BaseTransaction, type CreateSessionInput, type CreateTransactionInput, type ResolvedApprovaServerConfig, type ServerEnvironment, ServerEnvironmentSchema, SessionService, type SessionStatus, type StoredSession, type TransactionResult, TransactionService, type WebAuthnAuthenticationFinishInput, type WebAuthnAuthenticationStartInput, type WebAuthnConfig, type WebAuthnContext, type WebAuthnRegistrationFinishInput, type WebAuthnRegistrationStartInput, createServerConfig };
