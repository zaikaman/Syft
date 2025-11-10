import { encoding_for_model, TiktokenModel } from 'tiktoken';

/**
 * Token counting utility for OpenAI API context management
 * Uses tiktoken for accurate token counting
 */

let encoder: ReturnType<typeof encoding_for_model> | null = null;

/**
 * Initialize the tiktoken encoder for a specific model
 */
function getEncoder(model: string = 'gpt-5-nano-2025-08-07'): ReturnType<typeof encoding_for_model> {
  if (!encoder) {
    try {
      // Map our model names to tiktoken model names
      let tiktokenModel: TiktokenModel;
      
      if (model.includes('gpt-5-nano-2025-08-07')) {
        tiktokenModel = 'gpt-5-nano-2025-08-07' as TiktokenModel;
      } else if (model.includes('gpt-5-nano-2025-08-07')) {
        tiktokenModel = 'gpt-5-nano-2025-08-07' as TiktokenModel;
      } else {
        // Default to gpt-4 encoding for newer models
        tiktokenModel = 'gpt-5-nano-2025-08-07' as TiktokenModel;
      }
      
      encoder = encoding_for_model(tiktokenModel);
    } catch (error) {
      console.error('Error initializing tiktoken encoder:', error);
      throw error;
    }
  }
  return encoder;
}

/**
 * Count tokens in a single text string
 */
export function countTextTokens(text: string, model?: string): number {
  try {
    const enc = getEncoder(model);
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    console.error('Error counting text tokens:', error);
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens in a chat message (including role and formatting overhead)
 */
export function countMessageTokens(message: any, model?: string): number {
  try {
    let tokenCount = 0;
    
    // Count role tokens
    if (message.role) {
      tokenCount += countTextTokens(message.role, model);
    }
    
    // Count content tokens
    if (message.content) {
      if (typeof message.content === 'string') {
        tokenCount += countTextTokens(message.content, model);
      } else if (Array.isArray(message.content)) {
        // Handle multi-part content
        for (const part of message.content) {
          if (typeof part === 'string') {
            tokenCount += countTextTokens(part, model);
          } else if (part.text) {
            tokenCount += countTextTokens(part.text, model);
          }
        }
      }
    }
    
    // Count tool calls tokens
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        tokenCount += countTextTokens(JSON.stringify(toolCall), model);
      }
    }
    
    // Count tool call id tokens
    if (message.tool_call_id) {
      tokenCount += countTextTokens(message.tool_call_id, model);
    }
    
    // Add formatting overhead (roughly 4 tokens per message for OpenAI's formatting)
    tokenCount += 4;
    
    return tokenCount;
  } catch (error) {
    console.error('Error counting message tokens:', error);
    // Fallback estimate
    const jsonString = JSON.stringify(message);
    return Math.ceil(jsonString.length / 4);
  }
}

/**
 * Count total tokens in a conversation history
 */
export function countConversationTokens(messages: any[], model?: string): number {
  let totalTokens = 0;
  
  for (const message of messages) {
    totalTokens += countMessageTokens(message, model);
  }
  
  // Add 3 tokens for priming (OpenAI API overhead)
  totalTokens += 3;
  
  return totalTokens;
}

/**
 * Estimate tokens in function definitions
 */
export function countFunctionTokens(functions: any[], model?: string): number {
  try {
    // Functions are sent as JSON in the API
    const functionsJson = JSON.stringify(functions);
    return countTextTokens(functionsJson, model);
  } catch (error) {
    console.error('Error counting function tokens:', error);
    return Math.ceil(JSON.stringify(functions).length / 4);
  }
}

/**
 * Get detailed token breakdown for a conversation
 */
export function getTokenBreakdown(messages: any[], functions?: any[], model?: string): {
  messages: number;
  functions: number;
  total: number;
  breakdown: Array<{ role: string; tokens: number; index: number }>;
} {
  const breakdown = messages.map((msg, index) => ({
    role: msg.role,
    tokens: countMessageTokens(msg, model),
    index,
  }));
  
  const messagesTokens = breakdown.reduce((sum, item) => sum + item.tokens, 0);
  const functionsTokens = functions ? countFunctionTokens(functions, model) : 0;
  
  return {
    messages: messagesTokens,
    functions: functionsTokens,
    total: messagesTokens + functionsTokens + 3, // +3 for priming
    breakdown,
  };
}

/**
 * Check if conversation is approaching token limit
 */
export function isApproachingLimit(
  messages: any[],
  functions?: any[],
  limit: number = 100000,
  threshold: number = 0.8,
  model?: string
): { approaching: boolean; current: number; limit: number; percentage: number } {
  const { total } = getTokenBreakdown(messages, functions, model);
  const percentage = total / limit;
  
  return {
    approaching: percentage >= threshold,
    current: total,
    limit,
    percentage: Math.round(percentage * 100),
  };
}

/**
 * Clean up encoder resources
 */
export function cleanup(): void {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
}
