import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

if (!apiKey) {
  console.warn('WARNING: OPENAI_API_KEY not set. AI features will not be available.');
}

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key', // Use dummy key if not set to prevent crashes
  baseURL: 'https://v98store.com/v1',
});

// Prompt templates for different AI tasks

export const PROMPTS = {
  sentimentAnalysis: (text: string, asset: string) => `
Analyze the sentiment of the following text about ${asset} in the context of DeFi and cryptocurrency markets.
Provide a sentiment score from -1 (very negative) to 1 (very positive) and a brief explanation.

Text: "${text}"

Respond in JSON format:
{
  "sentiment_score": <number between -1 and 1>,
  "sentiment_label": "positive" | "neutral" | "negative",
  "explanation": "<brief explanation>",
  "key_topics": ["<topic1>", "<topic2>", ...]
}
`,

  strategyOptimization: (vaultConfig: any, marketData: any) => `
You are a DeFi strategy optimization expert. Analyze this vault configuration and current market conditions, then suggest improvements.

Vault Configuration:
${JSON.stringify(vaultConfig, null, 2)}

Market Data:
${JSON.stringify(marketData, null, 2)}

Provide 3-5 actionable suggestions to improve the vault's performance. Consider:
- Risk-adjusted returns
- Diversification
- Market conditions
- Gas efficiency
- Rebalancing frequency

Respond in JSON format:
{
  "suggestions": [
    {
      "title": "<suggestion title>",
      "description": "<detailed description>",
      "expected_impact": "<quantitative impact if possible>",
      "risk_level": "low" | "medium" | "high",
      "implementation": "<how to implement>",
      "priority": 1-5
    }
  ],
  "overall_assessment": "<overall assessment of current strategy>",
  "risk_score": <1-10>
}
`,

  ruleExplanation: (rule: any) => `
Explain this DeFi vault rule in simple, user-friendly language that a non-technical person can understand.

Rule:
${JSON.stringify(rule, null, 2)}

Provide a clear, concise explanation in plain English.
`,
};

// AI Service Functions

export async function analyzeSentiment(text: string, asset: string) {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a cryptocurrency market sentiment analysis expert.',
        },
        {
          role: 'user',
          content: PROMPTS.sentimentAnalysis(text, asset),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;
    return response ? JSON.parse(response) : null;
  } catch (error) {
    console.error('Error in sentiment analysis:', error);
    throw error;
  }
}

export async function generateStrategyOptimizations(vaultConfig: any, marketData: any) {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a DeFi strategy optimization expert with deep knowledge of yield farming, liquidity provision, and risk management.',
        },
        {
          role: 'user',
          content: PROMPTS.strategyOptimization(vaultConfig, marketData),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const response = completion.choices[0]?.message?.content;
    return response ? JSON.parse(response) : null;
  } catch (error) {
    console.error('Error generating strategy optimizations:', error);
    throw error;
  }
}

export async function explainRule(rule: any) {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that explains complex DeFi concepts in simple terms.',
        },
        {
          role: 'user',
          content: PROMPTS.ruleExplanation(rule),
        },
      ],
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error explaining rule:', error);
    throw error;
  }
}

export default openai;
