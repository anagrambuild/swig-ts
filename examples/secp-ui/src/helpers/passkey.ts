import { p256 } from '@noble/curves/p256';

export interface PasskeyCredential {
  id: string;
  publicKey: Uint8Array;
  rawId: ArrayBuffer;
}

export interface PasskeySignature {
  signature: Uint8Array;
  clientDataJSON: ArrayBuffer;
  authenticatorData: ArrayBuffer;
}

export class PasskeyManager {
  private static readonly STORAGE_KEY = 'swig-passkey-credential';

  /**
   * Create a new passkey credential for authentication
   */
  static async createPasskey(
    username: string = 'swig-user',
  ): Promise<PasskeyCredential> {
    if (!window.navigator.credentials) {
      throw new Error('WebAuthn not supported in this browser');
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions =
      {
        challenge,
        rp: {
          name: 'Swig Wallet',
          id: window.location.hostname,
        },
        user: {
          id: crypto.getRandomValues(new Uint8Array(64)),
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          {
            alg: -7, // ES256 (secp256r1 with SHA-256)
            type: 'public-key',
          },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'direct',
      };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential || !credential.response) {
      throw new Error('Failed to create passkey credential');
    }

    // Extract the public key from the attestation
    const response = credential.response as AuthenticatorAttestationResponse;

    const publicKey = this.spkiToCompressedPublicKey(response.getPublicKey()!);

    const passkeyCredential: PasskeyCredential = {
      id: credential.id,
      publicKey,
      rawId: credential.rawId,
    };

    // Store the credential for future use
    this.storeCredential(passkeyCredential);

    return passkeyCredential;
  }

  private static spkiToCompressedPublicKey(spkiPublicKey: ArrayBuffer) {
    // Ensure the input is a Uint8Array for easier manipulation
    const keyBytes = new Uint8Array(spkiPublicKey);

    // 1. Check if the key is the expected 91-byte SPKI format for P-256
    if (keyBytes.length !== 91) {
      throw new Error(
        'Invalid SPKI public key length. Expected 91 bytes for P-256.',
      );
    }

    // 2. Extract the raw 65-byte uncompressed public key.
    // It's always the last 65 bytes of the SPKI structure.
    const uncompressedKey = keyBytes.slice(-65);

    // The uncompressed key format is [0x04][32-byte X][32-byte Y]
    if (uncompressedKey[0] !== 0x04) {
      throw new Error('Invalid uncompressed public key format prefix.');
    }

    // 3. Extract the X and Y coordinates
    const x = uncompressedKey.slice(1, 33); // Bytes 1 to 32 are the X coordinate
    const y = uncompressedKey.slice(33, 65); // Bytes 33 to 64 are the Y coordinate

    // 4. Determine the compression prefix based on the parity of the Y-coordinate.
    // The parity is determined by the least significant bit of the last byte of Y.
    const lastYByte = y[y.length - 1];
    const prefix = (lastYByte & 1) === 0 ? 0x02 : 0x03;

    // 5. Construct the 33-byte compressed key
    const compressedKey = new Uint8Array(33);
    compressedKey[0] = prefix; // Set the prefix (0x02 or 0x03)
    compressedKey.set(x, 1); // Set the X-coordinate after the prefix

    return compressedKey;
  }

  /**
   * Sign a message using the stored passkey
   */
  static async signWithPasskey(
    messageHash: Uint8Array,
  ): Promise<PasskeySignature & { webAuthnMessage: Uint8Array }> {
    const credential = this.getStoredCredential();
    if (!credential) {
      throw new Error('No passkey credential found. Please create one first.');
    }

    // Use the message hash as the challenge for WebAuthn
    // WebAuthn expects the challenge to be the actual data we want to sign
    const challenge = messageHash.slice(0, 32); // Use first 32 bytes as challenge

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions =
      {
        challenge,
        allowCredentials: [
          {
            id: credential.rawId,
            type: 'public-key',
          },
        ],
        timeout: 60000,
        userVerification: 'preferred',
      };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion || !assertion.response) {
      throw new Error('Failed to get passkey assertion');
    }

    const response = assertion.response as AuthenticatorAssertionResponse;

    // Convert DER signature to raw 64-byte format for secp256r1 precompile
    const derSignature = new Uint8Array(response.signature);
    const rawSignature = this.derToRawSignature(derSignature);

    // Calculate the actual message that WebAuthn signed
    // WebAuthn signs: hash(authenticatorData + SHA256(clientDataJSON))
    const clientDataJSONHash = await crypto.subtle.digest(
      'SHA-256',
      response.clientDataJSON,
    );
    const authenticatorData = new Uint8Array(response.authenticatorData);

    // Concatenate authenticatorData + clientDataJSONHash to get message that
    // was hashed and signed, to use with secp256r1 precompile
    const webAuthnMessage = new Uint8Array(
      authenticatorData.length + clientDataJSONHash.byteLength,
    );
    webAuthnMessage.set(authenticatorData, 0);
    webAuthnMessage.set(
      new Uint8Array(clientDataJSONHash),
      authenticatorData.length,
    );

    return {
      signature: rawSignature,
      clientDataJSON: response.clientDataJSON,
      authenticatorData: response.authenticatorData,
      webAuthnMessage,
    };
  }

  /**
   * Get the stored passkey credential
   */
  static getStoredCredential(): PasskeyCredential | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored);
      return {
        id: parsed.id,
        publicKey: new Uint8Array(parsed.publicKey),
        rawId: this.base64ToArrayBuffer(parsed.rawId),
      };
    } catch (error) {
      console.error('Failed to parse stored credential:', error);
      return null;
    }
  }

  /**
   * Store the passkey credential
   */
  private static storeCredential(credential: PasskeyCredential): void {
    const toStore = {
      id: credential.id,
      publicKey: Array.from(credential.publicKey),
      rawId: this.arrayBufferToBase64(credential.rawId),
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toStore));
  }

  /**
   * Clear the stored passkey credential
   */
  static clearStoredCredential(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Check if passkey is supported
   */
  static isSupported(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      window.navigator?.credentials &&
      'create' in window.navigator.credentials &&
      'get' in window.navigator.credentials &&
      window.PublicKeyCredential
    );
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private static derToRawSignature(derSignature: Uint8Array): Uint8Array {
    const signature = p256.Signature.fromDER(derSignature);
    const normalizedSignature = signature.normalizeS();
    const rawSignature = normalizedSignature.toCompactRawBytes();

    return rawSignature;
  }
}
