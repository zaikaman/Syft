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
- Stellar has low fees (~0.00001 XLM) and fast finality (3-5 seconds)
- Vault smart contracts are written in Rust and deployed on Soroban
- Rebalancing happens via Stellar DEX or Soroswap router

SUPPORTED TESTNET ASSETS (WHITELIST):
IMPORTANT: You can ONLY use these assets when building vaults on testnet. DO NOT use any other tokens.

1. XLM (Native Stellar Lumens)
   - assetType: "XLM"
   - assetCode: "XLM"
   - assetIssuer: NOT REQUIRED (native asset)
   - Description: Native Stellar cryptocurrency

2. USDC (USD Coin by Circle)
   - assetType: "USDC"
   - assetCode: "USDC"
   - assetIssuer: NOT REQUIRED (system handles SAC conversion automatically)
   - Description: Stablecoin pegged to USD

3. XTAR (Custom Token)
   - assetType: "CUSTOM"
   - assetCode: "XTAR"
   - assetIssuer: "CCSV3Y6QKAPRZCPLCMC5W7OCS5BFPKMYFK5GC25SSSS44U2WA4Y7QRKE"

4. XRP (Custom Token)
   - assetType: "CUSTOM"
   - assetCode: "XRP"
   - assetIssuer: "CBFM34O7P6YJG2DCS3C7AJI6WDKD2JPMPPA7RTVYGC7ZYEPKDLGEIFP5"

5. ARST (Custom Token)
   - assetType: "CUSTOM"
   - assetCode: "ARST"
   - assetIssuer: "CB3TIJR2B5NZFKZLBUE5LAASV7WIRDKS24VPIYUXXEHM7XN3X2JXFHZY"

6. AQUA (Custom Token)
   - assetType: "CUSTOM"
   - assetCode: "AQUA"
   - assetIssuer: "CD56OXOMAZ55LIKCYVFXH5CP2AKCLYMPMBFRN5XIJVOTWOVY2KFGLZVJ"

7. EURC (Euro Coin)
   - assetType: "CUSTOM"
   - assetCode: "EURC"
   - assetIssuer: "CAUL6I3KR55BAOSOE23VRR5FUFD2EEBWF3DHGWUZN7N3ZGVR4QQU6DQM"

8. BTC (Bitcoin Token)
   - assetType: "CUSTOM"
   - assetCode: "BTC"
   - assetIssuer: "CBFX54THH4KKRDDOMV5G6TNGDPHXEUAXM7SGTOOXTZKODACI7O5ND6U7"

9. BRL (Brazilian Real Token)
   - assetType: "CUSTOM"
   - assetCode: "BRL"
   - assetIssuer: "CAG6QUTOUL3M4HPOPFYYDGJQODY7I3WUYKO2DFYDHIRHLD4HHPGIHWBJ"

10. RYAW (Custom Token)
    - assetType: "CUSTOM"
    - assetCode: "RYAW"
    - assetIssuer: "CBIWPSUKAYOE5ORIDLYNPFMWWNIZSA5LQVDNXYTW7HI4H5TIU64DGJ7F"

11. JAHV (Custom Token)
    - assetType: "CUSTOM"
    - assetCode: "JAHV"
    - assetIssuer: "CAZKRTMRBEMSMRCGC4C6YDUU22H5AVQZ5HAASR4PGWITXPDDBB3BTGHI"

12. VOEZ (Custom Token)
    - assetType: "CUSTOM"
    - assetCode: "VOEZ"
    - assetIssuer: "CDUCWV4VK6MXD3JMYFQUQ2KUHHGTMR7RAS6C2SPF7EHHUEGKFCRO3ZZF"

13. JORV (Custom Token)
    - assetType: "CUSTOM"
    - assetCode: "JORV"
    - assetIssuer: "CAT5EZTZVB4V4O7E5ZA2HQJTL7MZPWDJWQZIJYPMTAY6DMRWOIK5AMCD"

NOTE: These are verified testnet tokens. For custom tokens, ALWAYS include the assetIssuer.
If user requests assets not in this whitelist, explain that these are the available testnet tokens.

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
   
   FOR XLM (Native Asset):
   {
     "id": "asset-0",
     "type": "asset",
     "position": { "x": 100, "y": 100 },
     "data": {
       "assetType": "XLM",            // REQUIRED - must be "XLM" for native
       "assetCode": "XLM",            // REQUIRED - must be "XLM"
       "allocation": 50,              // REQUIRED - percentage (must sum to 100%)
       "label": "XLM"                 // REQUIRED - display name
       // DO NOT include assetIssuer for XLM
     }
   }
   
   FOR USDC (Stablecoin):
   {
     "id": "asset-1",
     "type": "asset",
     "position": { "x": 100, "y": 250 },
     "data": {
       "assetType": "USDC",           // REQUIRED - must be "USDC"
       "assetCode": "USDC",           // REQUIRED - must be "USDC"
       "allocation": 50,              // REQUIRED - percentage (must sum to 100%)
       "label": "USDC"                // REQUIRED - display name
       // DO NOT include assetIssuer - system handles SAC conversion
     }
   }
   
   FOR CUSTOM TOKENS (XTAR, XRP, ARST, AQUA, EURC, BTC, BRL, RYAW, JAHV, VOEZ, JORV):
   {
     "id": "asset-2",
     "type": "asset",
     "position": { "x": 100, "y": 400 },
     "data": {
       "assetType": "CUSTOM",         // REQUIRED - must be "CUSTOM" for custom tokens
       "assetCode": "AQUA",           // REQUIRED - token code from whitelist
       "assetIssuer": "CD56OXOMAZ55LIKCYVFXH5CP2AKCLYMPMBFRN5XIJVOTWOVY2KFGLZVJ",  // REQUIRED - exact issuer address
       "allocation": 25,              // REQUIRED - percentage (must sum to 100%)
       "label": "AQUA"                // REQUIRED - display name
     }
   }
   
2. **Condition Nodes**: Define rules/triggers for automated actions
   
   FOR TIME-BASED CONDITIONS:
   {
     "id": "condition-0",
     "type": "condition",
     "position": { "x": 500, "y": 100 },
     "data": {
       "conditionType": "time_based",              // REQUIRED
       "timeUnit": "days",                         // REQUIRED - "minutes" | "hours" | "days" | "weeks"
       "timeValue": 7,                             // REQUIRED - numeric value
       "label": "Every 7 days",                    // REQUIRED - display name
       "description": "Rebalance weekly"           // REQUIRED - explanation
     }
   }
   
   FOR PRICE CHANGE CONDITIONS:
   {
     "id": "condition-1",
     "type": "condition",
     "position": { "x": 500, "y": 250 },
     "data": {
       "conditionType": "price_change",            // REQUIRED
       "value": 5,                                 // REQUIRED - percentage change (e.g., 5 for 5%)
       "operator": "gt",                           // REQUIRED - "gt" | "lt" | "gte" | "lte"
       "label": "XLM price moves >5%",             // REQUIRED - display name
       "description": "Trigger when XLM price changes more than 5%"  // REQUIRED
     }
   }
   
   FOR ALLOCATION CONDITIONS:
   {
     "id": "condition-2",
     "type": "condition",
     "position": { "x": 500, "y": 400 },
     "data": {
       "conditionType": "allocation",              // REQUIRED
       "threshold": 10,                            // REQUIRED - percentage drift (e.g., 10 for 10%)
       "operator": "gt",                           // REQUIRED - "gt" | "lt" | "gte" | "lte"
       "label": "Allocation drifts >10%",          // REQUIRED - display name
       "description": "Rebalance when allocation deviates by 10%"  // REQUIRED
     }
   }
   
   FOR APY THRESHOLD CONDITIONS:
   {
     "id": "condition-3",
     "type": "condition",
     "position": { "x": 500, "y": 550 },
     "data": {
       "conditionType": "apy_threshold",           // REQUIRED
       "threshold": 8,                             // REQUIRED - APY percentage (e.g., 8 for 8%)
       "operator": "gt",                           // REQUIRED - "gt" | "lt" | "gte" | "lte"
       "label": "APY above 8%",                    // REQUIRED - display name
       "description": "Stake when APY exceeds 8%"  // REQUIRED
     }
   }
   
3. **Action Nodes**: Define what happens when conditions are met
   
   FOR REBALANCE ACTIONS:
   {
     "id": "action-0",
     "type": "action",
     "position": { "x": 900, "y": 100 },
     "data": {
       "actionType": "rebalance",                  // REQUIRED
       "label": "Rebalance Portfolio",             // REQUIRED - display name
       "description": "Rebalance to target allocations"  // REQUIRED
     }
   }
   
   FOR SWAP ACTIONS:
   {
     "id": "action-1",
     "type": "action",
     "position": { "x": 900, "y": 250 },
     "data": {
       "actionType": "swap",                       // REQUIRED
       "label": "Swap to USDC",                    // REQUIRED - display name
       "targetAsset": "USDC",                      // REQUIRED - asset to swap to
       "description": "Swap assets to USDC"       // REQUIRED
     }
   }
   
   FOR STAKE ACTIONS:
   {
     "id": "action-2",
     "type": "action",
     "position": { "x": 900, "y": 400 },
     "data": {
       "actionType": "stake",                      // REQUIRED
       "label": "Stake XLM",                       // REQUIRED - display name
       "targetAsset": "XLM",                       // REQUIRED - asset to stake
       "protocol": "Aquarius",                     // Optional - staking protocol
       "description": "Stake XLM for yield"       // REQUIRED
     }
   }
   
   FOR PROVIDE LIQUIDITY ACTIONS:
   {
     "id": "action-3",
     "type": "action",
     "position": { "x": 900, "y": 550 },
     "data": {
       "actionType": "provide_liquidity",          // REQUIRED
       "label": "Add Liquidity",                   // REQUIRED - display name
       "protocol": "Soroswap",                     // REQUIRED - liquidity protocol
       "description": "Provide liquidity to pool" // REQUIRED
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
1. **CRITICAL: ONLY use whitelisted testnet assets** - XLM, USDC, XTAR, XRP, ARST, AQUA, EURC, BTC, BRL, RYAW, JAHV, VOEZ, JORV
2. **Use correct assetType**:
   - "XLM" for native XLM
   - "USDC" for USDC stablecoin
   - "CUSTOM" for all other tokens (XTAR, XRP, ARST, AQUA, EURC, BTC, BRL, RYAW, JAHV, VOEZ, JORV)
3. **NEVER include assetIssuer for XLM or USDC** - System handles addresses automatically
4. **ALWAYS include assetIssuer for CUSTOM tokens** - Use exact issuer address from whitelist
5. **Allocations MUST sum to 100%**
6. **Every condition MUST have ALL required fields**:
   - time_based: MUST have timeUnit AND timeValue
   - price_change: MUST have value AND operator
   - allocation: MUST have threshold AND operator
   - apy_threshold: MUST have threshold AND operator
   - ALL conditions MUST have label AND description
7. **Every action MUST have ALL required fields**:
   - ALL actions MUST have actionType, label, AND description
   - swap: MUST have targetAsset (which asset to swap to)
   - stake: MUST have targetAsset (which asset to stake)
   - provide_liquidity: MUST have protocol
   - rebalance: label and description only
8. **Every condition MUST connect to an action**
8. **Assets should connect to conditions** (showing they're affected by rules)
9. **Provide helpful explanation and suggestions**
10. If user mentions assets not in whitelist, explain available testnet tokens and suggest alternatives from the whitelist

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
        // Define testnet whitelist
        const TESTNET_ASSETS = new Map([
          ['XLM', { assetType: 'XLM', requiresIssuer: false }],
          ['USDC', { assetType: 'USDC', requiresIssuer: false }],
          ['XTAR', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CCSV3Y6QKAPRZCPLCMC5W7OCS5BFPKMYFK5GC25SSSS44U2WA4Y7QRKE' }],
          ['XRP', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CBFM34O7P6YJG2DCS3C7AJI6WDKD2JPMPPA7RTVYGC7ZYEPKDLGEIFP5' }],
          ['ARST', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CB3TIJR2B5NZFKZLBUE5LAASV7WIRDKS24VPIYUXXEHM7XN3X2JXFHZY' }],
          ['AQUA', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CD56OXOMAZ55LIKCYVFXH5CP2AKCLYMPMBFRN5XIJVOTWOVY2KFGLZVJ' }],
          ['EURC', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CAUL6I3KR55BAOSOE23VRR5FUFD2EEBWF3DHGWUZN7N3ZGVR4QQU6DQM' }],
          ['BTC', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CBFX54THH4KKRDDOMV5G6TNGDPHXEUAXM7SGTOOXTZKODACI7O5ND6U7' }],
          ['BRL', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CAG6QUTOUL3M4HPOPFYYDGJQODY7I3WUYKO2DFYDHIRHLD4HHPGIHWBJ' }],
          ['RYAW', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CBIWPSUKAYOE5ORIDLYNPFMWWNIZSA5LQVDNXYTW7HI4H5TIU64DGJ7F' }],
          ['JAHV', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CAZKRTMRBEMSMRCGC4C6YDUU22H5AVQZ5HAASR4PGWITXPDDBB3BTGHI' }],
          ['VOEZ', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CDUCWV4VK6MXD3JMYFQUQ2KUHHGTMR7RAS6C2SPF7EHHUEGKFCRO3ZZF' }],
          ['JORV', { assetType: 'CUSTOM', requiresIssuer: true, assetIssuer: 'CAT5EZTZVB4V4O7E5ZA2HQJTL7MZPWDJWQZIJYPMTAY6DMRWOIK5AMCD' }]
        ]);

        // Validate and fix asset nodes
        assetNodes.forEach((node: Node) => {
          if (!node.data) {
            node.data = {};
          }

          const assetCode = node.data.assetCode as string;
          const assetInfo = TESTNET_ASSETS.get(assetCode);

          // Validate asset is in whitelist
          if (!assetInfo) {
            console.warn(`[NLVaultGenerator] Invalid asset ${assetCode} - not in testnet whitelist. Using XLM instead.`);
            node.data.assetCode = 'XLM';
            node.data.assetType = 'XLM';
            node.data.label = 'XLM';
            delete node.data.assetIssuer;
          } else {
            // Ensure correct asset type
            if (node.data.assetType !== assetInfo.assetType) {
              console.warn(`[NLVaultGenerator] Correcting assetType for ${assetCode}`);
              node.data.assetType = assetInfo.assetType;
            }

            // Handle issuer based on asset type
            if (assetInfo.requiresIssuer) {
              // Custom token - ensure issuer is set correctly
              if (!node.data.assetIssuer || node.data.assetIssuer !== assetInfo.assetIssuer) {
                console.warn(`[NLVaultGenerator] Setting correct assetIssuer for ${assetCode}`);
                node.data.assetIssuer = assetInfo.assetIssuer;
              }
            } else {
              // XLM or USDC - remove issuer as system handles it
              if (node.data.assetIssuer) {
                console.warn(`[NLVaultGenerator] Removing assetIssuer for ${assetCode} - system handles SAC conversion`);
                delete node.data.assetIssuer;
              }
            }
          }

          // Ensure allocation exists
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

      // Validate and fix condition nodes
      const conditionNodes = parsed.nodes.filter((n: Node) => n.type === 'condition');
      conditionNodes.forEach((node: Node) => {
        if (!node.data) {
          node.data = {};
        }

        const conditionType = node.data.conditionType as string;

        // Validate based on condition type
        switch (conditionType) {
          case 'time_based':
            if (!node.data.timeUnit) {
              console.warn(`[NLVaultGenerator] Condition ${node.id} missing timeUnit, setting to 'days'`);
              node.data.timeUnit = 'days';
            }
            if (!node.data.timeValue) {
              console.warn(`[NLVaultGenerator] Condition ${node.id} missing timeValue, setting to 7`);
              node.data.timeValue = 7;
            }
            break;

          case 'price_change':
            if (node.data.value === undefined || node.data.value === null) {
              console.warn(`[NLVaultGenerator] Condition ${node.id} missing value for price_change, setting to 5`);
              node.data.value = 5;
            }
            if (!node.data.operator) {
              console.warn(`[NLVaultGenerator] Condition ${node.id} missing operator, setting to 'gt'`);
              node.data.operator = 'gt';
            }
            break;

          case 'allocation':
          case 'apy_threshold':
            if (node.data.threshold === undefined || node.data.threshold === null) {
              console.warn(`[NLVaultGenerator] Condition ${node.id} missing threshold, setting to 10`);
              node.data.threshold = 10;
            }
            if (!node.data.operator) {
              console.warn(`[NLVaultGenerator] Condition ${node.id} missing operator, setting to 'gt'`);
              node.data.operator = 'gt';
            }
            break;
        }

        // Ensure label and description exist
        if (!node.data.label) {
          console.warn(`[NLVaultGenerator] Condition ${node.id} missing label, generating one`);
          node.data.label = `Condition ${node.id}`;
        }
        if (!node.data.description) {
          console.warn(`[NLVaultGenerator] Condition ${node.id} missing description, generating one`);
          node.data.description = `Auto-generated condition`;
        }
      });

      // Validate and fix action nodes
      const actionNodes = parsed.nodes.filter((n: Node) => n.type === 'action');
      actionNodes.forEach((node: Node) => {
        if (!node.data) {
          node.data = {};
        }

        const actionType = node.data.actionType as string;

        // Ensure actionType exists
        if (!actionType) {
          console.warn(`[NLVaultGenerator] Action ${node.id} missing actionType, setting to 'rebalance'`);
          node.data.actionType = 'rebalance';
        }

        // Validate based on action type
        switch (actionType) {
          case 'swap':
            if (!node.data.targetAsset) {
              console.warn(`[NLVaultGenerator] Action ${node.id} is swap but missing targetAsset, setting to 'USDC'`);
              node.data.targetAsset = 'USDC';
            }
            break;

          case 'stake':
            if (!node.data.targetAsset) {
              console.warn(`[NLVaultGenerator] Action ${node.id} is stake but missing targetAsset, setting to 'XLM'`);
              node.data.targetAsset = 'XLM';
            }
            break;

          case 'provide_liquidity':
            if (!node.data.protocol) {
              console.warn(`[NLVaultGenerator] Action ${node.id} is provide_liquidity but missing protocol, setting to 'Soroswap'`);
              node.data.protocol = 'Soroswap';
            }
            break;
        }

        // Ensure label and description exist
        if (!node.data.label) {
          console.warn(`[NLVaultGenerator] Action ${node.id} missing label, generating one`);
          node.data.label = `${actionType.charAt(0).toUpperCase() + actionType.slice(1).replace('_', ' ')} Action`;
        }
        if (!node.data.description) {
          console.warn(`[NLVaultGenerator] Action ${node.id} missing description, generating one`);
          node.data.description = `Auto-generated ${actionType} action`;
        }
      });

      console.log('[NLVaultGenerator] Vault generated successfully:', {
        nodeCount: parsed.nodes.length,
        edgeCount: parsed.edges.length,
        assetCount: assetNodes.length,
        conditionCount: conditionNodes.length,
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
