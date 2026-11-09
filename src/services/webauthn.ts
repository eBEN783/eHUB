/**
 * Web Authentication API (WebAuthn) Service for eHUB
 * Enables Fingerprint / Touch ID / Face ID / Windows Hello security for local sessions.
 */

// Helpers for buffer conversion
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Check if the current browser environment supports the Web Authentication API
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext !== false &&
    !!window.PublicKeyCredential &&
    typeof window.navigator?.credentials?.create === 'function' &&
    typeof window.navigator?.credentials?.get === 'function'
  );
}

/**
 * Check if a platform biometric authenticator (Fingerprint/Face ID/Touch ID) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch (err) {
    console.warn('[WebAuthn] Platform check error:', err);
    return false;
  }
}

export interface BiometricRegistrationResult {
  success: boolean;
  credentialId?: string;
  error?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  user?: {
    userId: string;
    email: string;
    displayName: string;
  };
  error?: string;
}

/**
 * Registers biometric authentication (Fingerprint / Face ID) for an existing user session
 */
export async function registerBiometrics(user: {
  userId: string;
  email: string;
  displayName: string;
}): Promise<BiometricRegistrationResult> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: 'Web Authentication API is not supported on this browser or device.',
    };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBuffer = new TextEncoder().encode(user.userId);

    // Hostname without port or path
    const hostname = window.location.hostname || 'localhost';

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'eHUB Abuja VTU & Bill Payments',
        id: hostname === 'localhost' || hostname.includes('.') ? hostname : undefined,
      },
      user: {
        id: userIdBuffer,
        name: user.email,
        displayName: user.displayName || user.email,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Fingerprint, Face ID, Touch ID, Windows Hello
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return {
        success: false,
        error: 'Biometric registration was declined or timed out.',
      };
    }

    const credentialId = bufferToBase64Url(credential.rawId);

    // Save to local storage for local session verification
    localStorage.setItem('ehub_biometric_enabled', 'true');
    localStorage.setItem(
      'ehub_biometric_user',
      JSON.stringify({
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
      })
    );
    localStorage.setItem(`ehub_biometric_cred_${user.userId}`, credentialId);

    return {
      success: true,
      credentialId,
    };
  } catch (err: unknown) {
    console.error('[WebAuthn] Registration error:', err);
    const error = err as { name?: string; message?: string };
    if (error.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Biometric prompt was cancelled or permission was denied.',
      };
    }
    if (error.name === 'InvalidStateError') {
      return {
        success: false,
        error: 'A biometric credential is already registered on this device.',
      };
    }
    return {
      success: false,
      error: error.message || 'Unable to register biometric credential on this device.',
    };
  }
}

/**
 * Authenticate the user with Fingerprint / Face ID
 */
export async function authenticateWithBiometrics(): Promise<BiometricAuthResult> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: 'Web Authentication API is not supported on this browser or device.',
    };
  }

  const savedUserStr = localStorage.getItem('ehub_biometric_user');
  if (!savedUserStr) {
    return {
      success: false,
      error: 'No biometric credential registered on this device yet. Please enable it in Settings.',
    };
  }

  let savedUser: { userId: string; email: string; displayName: string };
  try {
    savedUser = JSON.parse(savedUserStr);
  } catch {
    return {
      success: false,
      error: 'Corrupted biometric settings. Please re-enable Fingerprint/Face ID.',
    };
  }

  const credentialId = localStorage.getItem(`ehub_biometric_cred_${savedUser.userId}`);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const hostname = window.location.hostname || 'localhost';

  try {
    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credentialId) {
      allowCredentials.push({
        id: base64UrlToBuffer(credentialId),
        type: 'public-key',
        transports: ['internal'],
      });
    }

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: hostname === 'localhost' || hostname.includes('.') ? hostname : undefined,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred',
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return {
        success: false,
        error: 'Biometric verification cancelled.',
      };
    }

    return {
      success: true,
      user: savedUser,
    };
  } catch (err: unknown) {
    console.error('[WebAuthn] Authentication error:', err);
    const error = err as { name?: string; message?: string };
    if (error.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Fingerprint/Face ID scan was cancelled or failed.',
      };
    }
    return {
      success: false,
      error: error.message || 'Biometric authentication failed.',
    };
  }
}

/**
 * Disables Fingerprint / Face ID for the user
 */
export function disableBiometrics(userId: string) {
  try {
    localStorage.setItem('ehub_biometric_enabled', 'false');
    localStorage.removeItem(`ehub_biometric_cred_${userId}`);
    localStorage.removeItem('ehub_biometric_user');
  } catch (e) {
    console.warn('Failed to disable biometric storage:', e);
  }
}

/**
 * Checks if biometric login is currently enabled
 */
export function getSavedBiometricUser(): {
  userId: string;
  email: string;
  displayName: string;
} | null {
  try {
    const enabled = localStorage.getItem('ehub_biometric_enabled');
    if (enabled !== 'true') return null;
    const str = localStorage.getItem('ehub_biometric_user');
    if (!str) return null;
    return JSON.parse(str);
  } catch {
    return null;
  }
}
