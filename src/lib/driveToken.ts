export interface DriveTokenState {
  accessToken: string;
  acquiredAt: number;
  expiresAt: number;
}

const SESSION_STORAGE_KEY = "drive_token_state";

export function saveDriveTokenState(accessToken: string): DriveTokenState {
  const acquiredAt = Date.now();
  // Assume a 50 minute expiration (3000000 ms) as a safe default if actual is unknown
  // Google tokens typically last 60 minutes.
  const expiresAt = acquiredAt + 50 * 60 * 1000;
  
  const state: DriveTokenState = {
    accessToken,
    acquiredAt,
    expiresAt,
  };

  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
    // Clean up old localStorage if present
    localStorage.removeItem("drive_access_token");
  } catch (e) {
    console.error("Failed to save drive token to sessionStorage", e);
  }

  return state;
}

export function loadDriveTokenState(): DriveTokenState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    
    const state = JSON.parse(raw) as DriveTokenState;
    if (isDriveTokenLikelyExpired(state)) {
      clearDriveTokenState();
      return null;
    }
    return state;
  } catch (e) {
    console.error("Failed to load drive token from sessionStorage", e);
    return null;
  }
}

export function clearDriveTokenState(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem("drive_access_token");
  } catch (e) {
    console.error("Failed to clear drive token from sessionStorage", e);
  }
}

export function isDriveTokenLikelyExpired(state: DriveTokenState | null): boolean {
  if (!state) return true;
  // Add a 1 minute buffer
  return Date.now() + 60000 >= state.expiresAt;
}

export function getDriveAuthHeaders(accessToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${accessToken}`,
    // Optional: Keep custom header if server requires it, but standard Authorization is preferred
    "x-google-drive-token": accessToken
  };
}
