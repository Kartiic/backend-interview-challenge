export const CHALLENGE = {
  SYNC_RETRY_LIMIT: 3,
  SYNC_INTERVAL_MS: 5000,
  REMOTE_API_URL: "https://mockapi.io/fake-sync-endpoint",
  DEBUG_MODE: true,
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function logDebug(message: string, data?: any) {
  if (CHALLENGE.DEBUG_MODE) {
    console.log(`[DEBUG] ${message}`, data || "");
  }
}
