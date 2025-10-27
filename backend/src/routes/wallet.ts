// T041: Wallet API endpoints
// Purpose: API routes for wallet asset fetching and management

import { Router, Request, Response, NextFunction } from 'express';
import assetService from '../services/assetService';

const router = Router();

/**
 * GET /api/wallet/:address/assets
 * Fetch all asset balances for a wallet address
 */
router.get(
  '/:address/assets',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { address } = req.params;

      // Validate address format
      if (!address || !address.startsWith('G') || address.length !== 56) {
        res.status(400).json({
          success: false,
          error: 'Invalid Stellar address format. Address must start with G and be 56 characters long.',
        });
        return;
      }

      // Fetch assets
      const walletAssets = await assetService.fetchAssetBalances(address);

      res.json({
        success: true,
        data: walletAssets,
      });
    } catch (error: any) {
      // Handle specific errors
      if (error.message.includes('Account not found')) {
        res.status(404).json({
          success: false,
          error: 'Account not found',
          message: 'This account has not been funded yet on the Stellar network.',
        });
        return;
      }

      if (error.message.includes('Rate limit')) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again in a few moments.',
        });
        return;
      }

      // Pass to error handler middleware
      next(error);
    }
  }
);

/**
 * GET /api/wallet/:address/assets/:assetCode
 * Get balance for a specific asset
 * Query params: issuer (optional, for non-native assets)
 */
router.get(
  '/:address/assets/:assetCode',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { address, assetCode } = req.params;
      const { issuer } = req.query;

      // Validate address
      if (!address || !address.startsWith('G') || address.length !== 56) {
        res.status(400).json({
          success: false,
          error: 'Invalid Stellar address format',
        });
        return;
      }

      // Validate asset code
      if (!assetCode || assetCode.length > 12) {
        res.status(400).json({
          success: false,
          error: 'Invalid asset code',
        });
        return;
      }

      // Get balance
      const balance = await assetService.getAssetBalance(
        address,
        assetCode.toUpperCase(),
        issuer as string | undefined
      );

      res.json({
        success: true,
        data: {
          address,
          asset_code: assetCode.toUpperCase(),
          asset_issuer: issuer || null,
          balance,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * GET /api/wallet/:address/trustlines/:assetCode
 * Check if wallet has trustline for specific asset
 * Query params: issuer (required for non-native assets)
 */
router.get(
  '/:address/trustlines/:assetCode',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { address, assetCode } = req.params;
      const { issuer } = req.query;

      // Validate inputs
      if (!address || !address.startsWith('G') || address.length !== 56) {
        res.status(400).json({
          success: false,
          error: 'Invalid Stellar address format',
        });
        return;
      }

      if (!assetCode) {
        res.status(400).json({
          success: false,
          error: 'Asset code is required',
        });
        return;
      }

      if (!issuer) {
        res.status(400).json({
          success: false,
          error: 'Issuer address is required for trustline check',
        });
        return;
      }

      // Check trustline
      const hasTrustline = await assetService.hasAssetTrustline(
        address,
        assetCode.toUpperCase(),
        issuer as string
      );

      res.json({
        success: true,
        data: {
          address,
          asset_code: assetCode.toUpperCase(),
          asset_issuer: issuer,
          has_trustline: hasTrustline,
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * GET /api/wallet/:address/available/:assetCode
 * Get available balance (excluding liabilities)
 * Query params: issuer (optional, for non-native assets)
 */
router.get(
  '/:address/available/:assetCode',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { address, assetCode } = req.params;
      const { issuer } = req.query;

      // Validate address
      if (!address || !address.startsWith('G') || address.length !== 56) {
        res.status(400).json({
          success: false,
          error: 'Invalid Stellar address format',
        });
        return;
      }

      // Get available balance
      const availableBalance = await assetService.getAvailableBalance(
        address,
        assetCode.toUpperCase(),
        issuer as string | undefined
      );

      res.json({
        success: true,
        data: {
          address,
          asset_code: assetCode.toUpperCase(),
          asset_issuer: issuer || null,
          available_balance: availableBalance,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      next(error);
    }
  }
);

export default router;
