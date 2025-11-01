/**
 * Natural Language Vault Generator Service
 * Uses OpenAI with Tavily access to convert user natural language instructions
 * into structured vault configurations (nodes and edges for React Flow)
 */

import { openai } from '../lib/openaiClient';
import { tavilyService } from './tavilyService';

// Define Node and Edge types to match React Flow structure
export interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  type?: string;
}

export interface VaultGenerationRequest {
  userPrompt: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  currentVault?: {
    nodes: Node[];
    edges: Edge[];
    summary?: string;
  };
  network?: string;
}

export interface VaultGenerationResponse {
  nodes: Node[];
  edges: Edge[];
  explanation: string;
  marketContext?: string;
  suggestions?: string[];
  responseType?: 'chat' | 'build';
}

export class NaturalLanguageVaultGenerator {
  private readonly SYSTEM_PROMPT = `You are an expert DeFi vault architect specializing in the Stellar blockchain network.

CRITICAL CONTEXT - STELLAR NETWORK:
- These vaults operate on Stellar blockchain (NOT Ethereum)
- Stellar uses native DEX (SDEX) and protocols like Soroswap, Aquarius, Blend
- Common Stellar assets: XLM, USDC, AQUA, yXLM, BTC (Stellar), ETH (Stellar)
- Stellar has low fees (~0.00001 XLM) and fast finality (3-5 seconds)
- Vault smart contracts are written in Rust and deployed on Soroban
- Rebalancing happens via Stellar DEX or Soroswap router

YOUR CAPABILITIES:
1. **Chat conversationally** - Answer questions, explain concepts, provide advice
2. **Search the web** - Use when you need current market data, trends, or news
3. **Build vaults** - Generate structured vault configurations when user requests
4. **Edit vaults** - Modify existing vaults in the visual builder

WHEN TO BUILD A VAULT:
- User explicitly asks to create/build/generate a vault
- User provides specific allocation percentages and strategy details
- User wants to see a visual representation of their strategy
- User says phrases like "create a vault", "build me a", "generate a portfolio"

WHEN TO EDIT AN EXISTING VAULT:
- User asks to "change", "modify", "update", "adjust" the current vault
- User says "add X to my vault", "remove Y", "increase Z allocation"
- User wants to "make it more conservative/aggressive"
- A vault already exists in the builder (you'll see CURRENT VAULT IN BUILDER context)
- Keep existing parts the user doesn't mention and only change what they ask for

WHEN TO JUST CHAT:
- User asks general questions about DeFi, Stellar, or vault strategies
- User wants advice or recommendations without committing to build
- User is exploring options or learning
- User asks "how does X work?" or "what is Y?"
- User wants to refine/discuss before building

WHEN TO SEARCH THE WEB:
- User asks about current market conditions, prices, or trends
- User wants to know about specific asset performance or news
- User asks about recent DeFi protocol updates or developments
- You need real-time data to provide accurate advice
- Use the search_web function when needed

RESPONSE FORMAT:
When just chatting, respond with:
{
  "type": "chat",
  "message": "<your conversational response>",
  "suggestions": ["<optional suggestion 1>", "<optional suggestion 2>"]
}

When building a vault, respond with:
{
  "type": "build",
  "nodes": [...],
  "edges": [...],
  "explanation": "<explanation of the vault>",
  "suggestions": ["<optional suggestion 1>", "<optional suggestion 2>"]
}

VAULT STRUCTURE (when building):

CRITICAL: Every node MUST have ALL required fields populated. Do not leave any data properties empty or undefined.

1. **Asset Nodes**: Define which tokens the vault will hold and their allocations
   Structure:
   {
     "id": "asset-0",
     "type": "asset",
     "position": { "x": 100, "y": 100 },
     "data": {
       "assetType": "XLM" | "USDC" | "CUSTOM",
       "assetCode": "XLM",           // REQUIRED - the asset symbol
       "assetIssuer": "CA...",        // Optional - contract address for custom tokens
       "allocation": 50,              // REQUIRED - percentage (must sum to 100% across all assets)
       "label": "XLM"                 // REQUIRED - display name
     }
   }
   
2. **Condition Nodes**: Define rules/triggers for automated actions
   Structure:
   {
     "id": "condition-0",
     "type": "condition",
     "position": { "x": 500, "y": 100 },
     "data": {
       "conditionType": "time_based" | "allocation" | "apy_threshold" | "price_change",  // REQUIRED
       "label": "Every 7 days",                    // REQUIRED - display name
       "description": "Rebalance weekly",          // REQUIRED - explanation
       // For time_based:
       "timeUnit": "minutes" | "hours" | "days" | "weeks",  // REQUIRED for time_based
       "timeValue": 7,                             // REQUIRED for time_based
       // For threshold-based:
       "threshold": 10,                            // REQUIRED for apy_threshold/price_change/allocation
       "operator": "gt" | "lt" | "eq" | "gte" | "lte"  // Optional
     }
   }
   
3. **Action Nodes**: Define what happens when conditions are met
   Structure:
   {
     "id": "action-0",
     "type": "action",
     "position": { "x": 900, "y": 100 },
     "data": {
       "actionType": "rebalance" | "stake" | "provide_liquidity" | "swap",  // REQUIRED
       "label": "Rebalance Portfolio",             // REQUIRED - display name
       "targetAsset": "XLM",                       // Optional - for stake/swap actions
       "targetAllocation": 50,                     // Optional - for rebalance actions
       "protocol": "Aquarius",                     // Optional - for stake/liquidity actions
       "parameters": {}                            // Optional - additional config
     }
   }
   
4. **Edges**: Connect nodes to show flow (assets → conditions → actions)
   Structure:
   {
     "id": "edge-0",
     "source": "asset-0",      // REQUIRED - source node id
     "target": "condition-0",  // REQUIRED - target node id
     "animated": true          // Optional - makes edge animated
   }

COMPLETE EXAMPLE:
{
  "type": "build",
  "nodes": [
    {
      "id": "asset-0",
      "type": "asset",
      "position": { "x": 100, "y": 100 },
      "data": {
        "assetType": "XLM",
        "assetCode": "XLM",
        "allocation": 60,
        "label": "XLM"
      }
    },
    {
      "id": "asset-1",
      "type": "asset",
      "position": { "x": 100, "y": 250 },
      "data": {
        "assetType": "USDC",
        "assetCode": "USDC",
        "allocation": 40,
        "label": "USDC"
      }
    },
    {
      "id": "condition-0",
      "type": "condition",
      "position": { "x": 500, "y": 175 },
      "data": {
        "conditionType": "time_based",
        "timeUnit": "days",
        "timeValue": 7,
        "label": "Every 7 days",
        "description": "Rebalance weekly"
      }
    },
    {
      "id": "action-0",
      "type": "action",
      "position": { "x": 900, "y": 175 },
      "data": {
        "actionType": "rebalance",
        "label": "Rebalance Portfolio"
      }
    }
  ],
  "edges": [
    { "id": "edge-0", "source": "asset-0", "target": "condition-0", "animated": true },
    { "id": "edge-1", "source": "asset-1", "target": "condition-0", "animated": true },
    { "id": "edge-2", "source": "condition-0", "target": "action-0", "animated": true }
  ],
  "explanation": "This vault holds 60% XLM and 40% USDC, rebalancing weekly to maintain target allocations.",
  "suggestions": [
    "Consider adding a price-change condition for more reactive rebalancing",
    "You might want to stake a portion of XLM for additional yield"
  ]
}

NODE POSITIONING:
- Assets start at left (x: 0-200, y: spaced by 150)
- Conditions in middle (x: 400-600, y: spaced by 150)
- Actions at right (x: 800-1000, y: spaced by 150)

IMPORTANT RULES (when building):
1. Allocations MUST sum to 100%
2. Every condition MUST connect to an action
3. Assets should connect to conditions (showing they're affected by rules)
4. Use realistic Stellar asset codes (XLM, USDC, AQUA, yXLM, etc.)
5. Time-based conditions use: minutes, hours, days, weeks
6. Provide helpful explanation and suggestions
7. If user mentions staking, use protocols like Aquarius or native Stellar staking
8. If user mentions liquidity, reference Soroswap pools

Be conversational and helpful. Build vaults only when the user is ready and has provided enough details.`;

  /**
   * Search web for market context (called by OpenAI via function calling)
   */
  private async searchWeb(query: string): Promise<string> {
    if (!tavilyService.isConfigured()) {
      return 'Web search not available - Tavily API not configured.';
    }

    try {
      console.log('[NLVaultGenerator] Searching web:', query);
      const searchResults = await tavilyService.search(query, {
        searchDepth: 'basic',
        maxResults: 3,
        includeAnswer: true,
      });

      if (searchResults.answer) {
        return searchResults.answer;
      }

      // Fallback to summarizing results
      if (searchResults.results.length > 0) {
        return searchResults.results
          .map(r => `${r.title}: ${r.content.substring(0, 200)}...`)
          .join('\n\n');
      }

      return 'No relevant information found.';
    } catch (error) {
      console.error('[NLVaultGenerator] Web search failed:', error);
      return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Generate vault configuration from natural language
   */
  async generateVault(request: VaultGenerationRequest): Promise<VaultGenerationResponse> {
    const { userPrompt, conversationHistory = [], currentVault } = request;

    console.log('[NLVaultGenerator] Processing prompt:', userPrompt);
    if (currentVault && currentVault.nodes.length > 0) {
      console.log('[NLVaultGenerator] Current vault context:', {
        nodeCount: currentVault.nodes.length,
        edgeCount: currentVault.edges.length,
      });
    }

    // Build conversation messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: this.SYSTEM_PROMPT,
      },
    ];

    // Add current vault context if exists
    if (currentVault && currentVault.nodes.length > 0) {
      messages.push({
        role: 'system',
        content: `CURRENT VAULT IN BUILDER:\n${currentVault.summary || JSON.stringify(currentVault, null, 2)}\n\nThe user can see this vault in the visual builder. If they ask to modify it, return an updated version. If they ask to create a new vault, ignore the current vault and create from scratch.`,
      });
    }

    // Add conversation history if exists
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    // Add current user prompt
    messages.push({
      role: 'user',
      content: userPrompt,
    });

    // Define function tools for OpenAI
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'search_web',
          description: 'Search the web for current market data, trends, news, or DeFi protocol information. Use this when you need real-time information about crypto markets, asset performance, or Stellar ecosystem updates.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query (e.g., "Stellar XLM price trends 2025" or "Soroswap DeFi latest updates")',
              },
            },
            required: ['query'],
          },
        },
      },
    ];

    try {
      console.log('[NLVaultGenerator] Calling OpenAI API...');
      
      // Check if we should enable function calling
      const enableFunctionCalling = tavilyService.isConfigured();
      
      // First API call - let AI decide if it needs to search or can respond directly
      // Note: Cannot use response_format with tools, so we'll rely on the system prompt
      let response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-5-nano-2025-08-07',
        messages,
        temperature: 0.7,
        ...(enableFunctionCalling ? {
          tools,
          tool_choice: 'auto',
        } : {
          response_format: { type: 'json_object' },
        }),
      });

      let finalResponse = response.choices[0].message;

      // Handle function calls (web search)
      if (finalResponse.tool_calls && finalResponse.tool_calls.length > 0) {
        console.log('[NLVaultGenerator] AI requested web search');
        
        // Add assistant's function call to conversation (cast to any for tool_calls)
        messages.push(finalResponse as any);

        // Execute function calls
        for (const toolCall of finalResponse.tool_calls) {
          if (toolCall.function.name === 'search_web') {
            const args = JSON.parse(toolCall.function.arguments);
            const searchResult = await this.searchWeb(args.query);
            
            // Add function result to conversation
            messages.push({
              role: 'function' as any,
              name: 'search_web',
              content: searchResult,
            } as any);
          }
        }

        // Make second API call with search results - now request JSON format
        console.log('[NLVaultGenerator] Calling OpenAI with search results...');
        response = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          messages: messages as any,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        });

        finalResponse = response.choices[0].message;
      }

      const content = finalResponse.content || '{}';
      console.log('[NLVaultGenerator] OpenAI response received, length:', content.length);
      
      const parsed = JSON.parse(content);

      // Check response type
      if (parsed.type === 'chat') {
        // AI decided to just chat, not build
        console.log('[NLVaultGenerator] AI response: chat only (no vault generation)');
        return {
          nodes: [],
          edges: [],
          explanation: parsed.message || '',
          suggestions: parsed.suggestions || [],
          responseType: 'chat',
        };
      }

      // AI decided to build a vault
      console.log('[NLVaultGenerator] AI response: building vault');

      // Validate response structure
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error('Invalid response: missing nodes array');
      }
      if (!parsed.edges || !Array.isArray(parsed.edges)) {
        throw new Error('Invalid response: missing edges array');
      }

      // Validate and fix asset nodes
      const assetNodes = parsed.nodes.filter((n: Node) => n.type === 'asset');
      
      if (assetNodes.length === 0) {
        console.warn('[NLVaultGenerator] No asset nodes found in response');
      } else {
        // Ensure all asset nodes have data and allocation
        assetNodes.forEach((node: Node) => {
          if (!node.data) {
            node.data = {};
          }
          if (node.data.allocation === undefined || node.data.allocation === null) {
            console.warn(`[NLVaultGenerator] Asset node ${node.id} missing allocation, setting to 0`);
            node.data.allocation = 0;
          }
        });

        // Calculate total allocation
        const totalAllocation = assetNodes.reduce((sum: number, node: Node) => {
          return sum + (Number(node.data.allocation) || 0);
        }, 0);

        // Normalize allocations to 100% if needed
        if (assetNodes.length > 0 && Math.abs(totalAllocation - 100) > 0.1) {
          console.warn(`[NLVaultGenerator] Allocations sum to ${totalAllocation}%, adjusting...`);
          
          if (totalAllocation === 0) {
            // Distribute evenly if all are 0
            const equalAllocation = 100 / assetNodes.length;
            assetNodes.forEach((node: Node) => {
              node.data.allocation = equalAllocation;
            });
          } else {
            // Normalize proportionally
            assetNodes.forEach((node: Node) => {
              const currentAllocation = Number(node.data.allocation) || 0;
              node.data.allocation = (currentAllocation / totalAllocation) * 100;
            });
          }
        }
      }

      console.log('[NLVaultGenerator] Vault generated successfully:', {
        nodeCount: parsed.nodes.length,
        edgeCount: parsed.edges.length,
        assetCount: assetNodes.length,
      });

      return {
        nodes: parsed.nodes,
        edges: parsed.edges,
        explanation: parsed.explanation || 'Vault configuration generated successfully.',
        suggestions: parsed.suggestions || [],
        responseType: 'build',
      };
    } catch (error) {
      console.error('[NLVaultGenerator] Failed to process request:', error);
      throw new Error(
        `Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refine an existing vault configuration based on user feedback
   */
  async refineVault(
    currentNodes: Node[],
    currentEdges: Edge[],
    userFeedback: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<VaultGenerationResponse> {
    console.log('[NLVaultGenerator] Refining vault based on feedback:', userFeedback);

    // Add current vault state to conversation
    const vaultStateMessage = `Current vault configuration:\n${JSON.stringify(
      { nodes: currentNodes, edges: currentEdges },
      null,
      2
    )}`;

    const updatedHistory = [
      ...conversationHistory,
      {
        role: 'assistant' as const,
        content: vaultStateMessage,
      },
    ];

    return this.generateVault({
      userPrompt: userFeedback,
      conversationHistory: updatedHistory,
    });
  }
}

// Export singleton instance
export const naturalLanguageVaultGenerator = new NaturalLanguageVaultGenerator();
