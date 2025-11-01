/**
 * Chat History Service
 * Manages AI chat conversation history and sessions
 */

import { supabase } from '../lib/supabase';
import { randomUUID } from 'crypto';

export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatSessionStatus = 'active' | 'completed' | 'abandoned';

export interface ChatSession {
  id: string;
  sessionId: string;
  userId?: string;
  vaultId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  status: ChatSessionStatus;
  network?: string;
  initialPrompt?: string;
  totalMessages: number;
  vaultGenerated: boolean;
  vaultDeployed: boolean;
}

export interface ChatMessage {
  id: string;
  messageId: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: Date;
  tokensUsed?: number;
  model?: string;
  responseType?: string;
  vaultSnapshot?: any;
  marketContext?: string;
  webSearchUsed: boolean;
  sequenceNumber: number;
}

export interface CreateSessionParams {
  userId?: string;
  vaultId?: string;
  network?: string;
  initialPrompt?: string;
}

export interface CreateMessageParams {
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  tokensUsed?: number;
  model?: string;
  responseType?: string;
  vaultSnapshot?: any;
  marketContext?: string;
  webSearchUsed?: boolean;
}

export class ChatHistoryService {
  /**
   * Create a new chat session
   */
  static async createSession(params: CreateSessionParams): Promise<ChatSession> {
    const sessionId = `session_${randomUUID()}`;

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        session_id: sessionId,
        user_id: params.userId || null,
        vault_id: params.vaultId || null,
        network: params.network || null,
        initial_prompt: params.initialPrompt || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create chat session: ${error.message}`);
    }

    return this.mapSessionRow(data);
  }

  /**
   * Get a chat session by ID
   */
  static async getSession(sessionId: string): Promise<ChatSession | null> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapSessionRow(data);
  }

  /**
   * Get all sessions for a user
   */
  static async getUserSessions(userId: string, limit = 50): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapSessionRow(row));
  }

  /**
   * Get sessions for a vault
   */
  static async getVaultSessions(vaultId: string, limit = 20): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('vault_id', vaultId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get vault sessions: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapSessionRow(row));
  }

  /**
   * Add a message to a session
   */
  static async addMessage(params: CreateMessageParams): Promise<ChatMessage> {
    const messageId = `msg_${randomUUID()}`;

    // First, get the session UUID from session_id
    const { data: sessionData, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('session_id', params.sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error('[ChatHistory] Session not found:', params.sessionId, sessionError);
      throw new Error(`Session not found: ${params.sessionId}`);
    }

    const sessionUuid = sessionData.id;

    // Get current message count for sequence number
    const { count, error: countError } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionUuid);

    if (countError) {
      console.error('[ChatHistory] Error counting messages:', countError);
      // If table doesn't exist, throw a more helpful error
      if (countError.message.includes('relation') || countError.message.includes('does not exist')) {
        throw new Error('Chat history tables not found. Please run migration 014_chat_history.sql in Supabase.');
      }
      throw new Error(`Failed to count messages: ${countError.message}`);
    }

    const sequenceNumber = count || 0;

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        message_id: messageId,
        session_id: sessionUuid, // Use UUID instead of TEXT session_id
        role: params.role,
        content: params.content,
        tokens_used: params.tokensUsed || null,
        model: params.model || null,
        response_type: params.responseType || null,
        vault_snapshot: params.vaultSnapshot || null,
        market_context: params.marketContext || null,
        web_search_used: params.webSearchUsed || false,
        sequence_number: sequenceNumber,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add message: ${error.message}`);
    }

    return this.mapMessageRow(data);
  }

  /**
   * Get all messages for a session
   */
  static async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    // First, get the session UUID from session_id
    const { data: sessionData, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error('[ChatHistory] Session not found:', sessionId);
      return []; // Return empty array if session not found
    }

    const sessionUuid = sessionData.id;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionUuid)
      .order('sequence_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to get session messages: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapMessageRow(row));
  }

  /**
   * Update session status
   */
  static async updateSessionStatus(
    sessionId: string,
    status: ChatSessionStatus
  ): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('chat_sessions')
      .update(updateData)
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Failed to update session status: ${error.message}`);
    }
  }

  /**
   * Mark vault as generated in session
   */
  static async markVaultGenerated(sessionId: string, vaultId?: string): Promise<void> {
    const updateData: any = { vault_generated: true };
    
    if (vaultId) {
      updateData.vault_id = vaultId;
    }

    const { error } = await supabase
      .from('chat_sessions')
      .update(updateData)
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Failed to mark vault as generated: ${error.message}`);
    }
  }

  /**
   * Mark vault as deployed in session
   */
  static async markVaultDeployed(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ vault_deployed: true })
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Failed to mark vault as deployed: ${error.message}`);
    }
  }

  /**
   * Get conversation history in format for OpenAI
   */
  static async getConversationHistory(
    sessionId: string
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.getSessionMessages(sessionId);

    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
  }

  /**
   * Delete old sessions (cleanup)
   */
  static async deleteOldSessions(daysOld = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from('chat_sessions')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .neq('status', 'active')
      .select();

    if (error) {
      throw new Error(`Failed to delete old sessions: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Map database row to ChatSession
   */
  private static mapSessionRow(row: any): ChatSession {
    return {
      id: row.id,
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
    };
  }

  /**
   * Map database row to ChatMessage
   */
  private static mapMessageRow(row: any): ChatMessage {
    return {
      id: row.id,
      messageId: row.message_id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
      tokensUsed: row.tokens_used,
      model: row.model,
      responseType: row.response_type,
      vaultSnapshot: row.vault_snapshot,
      marketContext: row.market_context,
      webSearchUsed: row.web_search_used,
      sequenceNumber: row.sequence_number,
    };
  }
}

export const chatHistoryService = ChatHistoryService;
