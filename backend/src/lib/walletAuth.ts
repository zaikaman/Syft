// T031: Wallet signature verification utility
// Purpose: Verify wallet signatures for authentication and authorization

import StellarSdk from '@stellar/stellar-sdk';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../middleware/errorHandler';

/**
 * Verify a signed message from a Stellar wallet
 * @param publicKey - The public key (address) of the signer
 * @param message - The original message that was signed
 * @param signature - The signature to verify
 * @returns boolean indicating if signature is valid
 */
export function verifyWalletSignature(
  publicKey: string,
  message: string,
  signature: string
): boolean {
  try {
    // Create a keypair from the public key
    const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
    
    // Convert message to buffer
    const messageBuffer = Buffer.from(message, 'utf-8');
    
    // Convert signature from base64 to buffer
    const signatureBuffer = Buffer.from(signature, 'base64');
    
    // Verify the signature
    return keypair.verify(messageBuffer, signatureBuffer);
  } catch (error) {
    console.error('Error verifying wallet signature:', error);
    return false;
  }
}

/**
 * Generate a challenge message for wallet authentication
 * @param walletAddress - The wallet address requesting authentication
 * @returns Challenge message to be signed by the wallet
 */
export function generateAuthChallenge(walletAddress: string): string {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2, 15);
  
  return `Syft DeFi Platform Authentication
Wallet: ${walletAddress}
Timestamp: ${timestamp}
Nonce: ${nonce}

Please sign this message to authenticate with Syft.`;
}

/**
 * Middleware to verify wallet authentication
 * Expects headers:
 * - X-Wallet-Address: The wallet public key
 * - X-Signature: The signed message
 * - X-Message: The original message that was signed
 */
export function requireWalletAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const walletAddress = req.headers['x-wallet-address'] as string;
  const signature = req.headers['x-signature'] as string;
  const message = req.headers['x-message'] as string;

  if (!walletAddress || !signature || !message) {
    throw new UnauthorizedError('Missing authentication headers');
  }

  // Verify the signature
  const isValid = verifyWalletSignature(walletAddress, message, signature);

  if (!isValid) {
    throw new UnauthorizedError('Invalid wallet signature');
  }

  // Check if message is recent (within 5 minutes)
  const timestampMatch = message.match(/Timestamp: (\d+)/);
  if (timestampMatch) {
    const messageTimestamp = parseInt(timestampMatch[1]);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - messageTimestamp > fiveMinutes) {
      throw new UnauthorizedError('Authentication message expired');
    }
  }

  // Add wallet address to request for use in route handlers
  (req as any).walletAddress = walletAddress;

  next();
}

/**
 * Optional wallet auth - doesn't fail if no auth provided
 * Useful for endpoints that work with or without authentication
 */
export function optionalWalletAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const walletAddress = req.headers['x-wallet-address'] as string;
  const signature = req.headers['x-signature'] as string;
  const message = req.headers['x-message'] as string;

  if (walletAddress && signature && message) {
    const isValid = verifyWalletSignature(walletAddress, message, signature);
    if (isValid) {
      (req as any).walletAddress = walletAddress;
    }
  }

  next();
}

/**
 * Verify wallet ownership of a resource
 * @param walletAddress - The wallet address to check
 * @param resourceOwner - The owner address of the resource
 * @returns boolean indicating if wallet owns the resource
 */
export function verifyOwnership(
  walletAddress: string,
  resourceOwner: string
): boolean {
  return walletAddress === resourceOwner;
}
