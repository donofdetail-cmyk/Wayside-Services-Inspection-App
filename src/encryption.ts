import { supabase } from './d2d/supabaseClient';

const SALT = new TextEncoder().encode("wayside_secure_offline_salt_v1");

async function getKey(): Promise<CryptoKey> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id || 'anonymous_fallback';
  
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(userId),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(data: any): Promise<string> {
  const key = await getKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(JSON.stringify(data));
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData
  );

  const ivBase64 = btoa(String.fromCharCode(...iv));
  const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  
  return JSON.stringify({ iv: ivBase64, data: encryptedBase64 });
}

export async function decryptData(encryptedStr: string): Promise<any> {
  try {
    const payload = JSON.parse(encryptedStr);
    const key = await getKey();
    
    const iv = new Uint8Array(atob(payload.iv).split('').map(c => c.charCodeAt(0)));
    const encryptedData = new Uint8Array(atob(payload.data).split('').map(c => c.charCodeAt(0)));
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedData
    );
    
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    console.error("Decryption failed", e);
    return null;
  }
}
