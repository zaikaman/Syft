/**
 * Chat History API Routes
 * Handles chat session management and history
 */

import express, { Request, Response } from 'express';
import { chatHistoryService } from '../services/chatHistoryService';

const router = express.Router();

/**
 * Create a new chat session
 * POST /api/chat/sessions
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, walletAddress, vaultId, network, initialPrompt } = req.body;

    console.log('[Chat API] Creating session with wallet:', walletAddress);

    // If walletAddress is provided, ensure user exists or create one
    let resolvedUserId = userId;
    if (walletAddress && !userId) {
      const { supabase } = await import('../lib/supabase.js');
      
      // Try to find existing user by wallet address
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();
      
      if (existingUser) {
        console.log('[Chat API] Found existing user:', existingUser.id);
        resolvedUserId = existingUser.id;
      } else {
        console.log('[Chat API] Creating new user for wallet:', walletAddress);
        // Create new user with wallet address
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            wallet_address: walletAddress,
            network: network || 'testnet',
          })
          .select('id')
          .single();
        
        if (userError) {
          console.error('[Chat API] Error creating user:', userError);
        } else if (newUser) {
          console.log('[Chat API] Created new user:', newUser.id);
          resolvedUserId = newUser.id;
        }
      }
    }

    console.log('[Chat API] Creating session with userId:', resolvedUserId);

    const session = await chatHistoryService.createSession({
      userId: resolvedUserId,
      vaultId,
      network,
      initialPrompt,
    });

    console.log('[Chat API] Created session:', session.sessionId);

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('[Chat API] Error creating session:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create session',
    });
  }
});

/**
 * Get all sessions (optionally filtered by user or wallet address)
 * GET /api/chat/sessions?userId=xxx or ?walletAddress=xxx
 */
router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, walletAddress, limit } = req.query;
    
    console.log('[Chat API] Getting sessions for wallet:', walletAddress);
    
    let sessions: any[] = [];
    
    if (walletAddress) {
      // Filter by wallet address - first get user_id
      const { supabase } = await import('../lib/supabase.js');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress as string)
        .single();
      
      if (userError) {
        console.log('[Chat API] User not found for wallet:', walletAddress, userError.message);
        // Return empty array if user doesn't exist yet
        res.json({
          success: true,
          data: [],
        });
        return;
      }
      
      if (userData) {
        console.log('[Chat API] Found user:', userData.id);
        sessions = await chatHistoryService.getUserSessions(userData.id, limit ? parseInt(limit as string) : 50);
        console.log('[Chat API] Found sessions:', sessions.length);
      }
    } else if (userId) {
      sessions = await chatHistoryService.getUserSessions(userId as string, limit ? parseInt(limit as string) : 50);
    } else {
      // For now, return all recent sessions if no user specified
      // In production, you'd want authentication
      const { data, error } = await (await import('../lib/supabase.js')).supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit ? parseInt(limit as string) : 50);

      if (error) {
        throw new Error(error.message);
      }

      sessions = (data || []).map((row: any) => ({
        sessionId: row.session_id,
        userId: row.user_id,
        vaultId: row.vault_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        status: row.status,
        network: row.network,
        initialPrompt: row.initial_prompt,
        totalMessages: row.total_messages,
        vaultGenerated: row.vault_generated,
        vaultDeployed: row.vault_deployed,
      }));
    }

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('[Chat API] Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sessions',
    });
  }
});

/**
 * Get a specific session
 * GET /api/chat/sessions/:sessionId
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await chatHistoryService.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('[Chat API] Error getting session:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session',
    });
  }
});

/**
 * Get messages for a session
 * GET /api/chat/sessions/:sessionId/messages
 */
router.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const messages = await chatHistoryService.getSessionMessages(sessionId);

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('[Chat API] Error getting messages:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get messages',
    });
  }
});

/**
 * Delete a session
 * DELETE /api/chat/sessions/:sessionId
 */
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await chatHistoryService.updateSessionStatus(sessionId, 'abandoned');

    res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    console.error('[Chat API] Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete session',
    });
  }
});

/**
 * Update session status
 * PATCH /api/chat/sessions/:sessionId/status
 */
router.patch('/sessions/:sessionId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;

    if (!['active', 'completed', 'abandoned'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
      return;
    }

    await chatHistoryService.updateSessionStatus(sessionId, status);

    res.json({
      success: true,
      message: 'Session status updated',
    });
  } catch (error) {
    console.error('[Chat API] Error updating session status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update session status',
    });
  }
});

export default router;
