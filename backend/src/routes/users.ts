// User management API endpoints
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

/**
 * POST /api/users/register
 * Register or update a user when they connect their wallet
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { walletAddress, network } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    // Validate wallet address format
    if (!walletAddress.startsWith('G') || walletAddress.length !== 56) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Stellar wallet address format',
      });
    }

    // Upsert user (insert if new, update if exists)
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          wallet_address: walletAddress,
          network: network || 'futurenet',
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'wallet_address',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error registering user:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to register user',
      });
    }

    return res.json({
      success: true,
      data: {
        walletAddress: data.wallet_address,
        message: 'User registered successfully',
      },
    });
  } catch (error) {
    console.error('Error in POST /api/users/register:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/users/:walletAddress
 * Get user profile information
 */
router.get('/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error in GET /api/users/:walletAddress:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
