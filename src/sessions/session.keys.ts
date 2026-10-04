export function sessionKey(appId: string, sessionId: string): string {
  return `approva:session:${appId}:${sessionId}`;
}

export function sessionPrefix(appId: string): string {
  return `approva:session:${appId}:`;
}
