import { Runware } from '@runware/sdk-js';

// Singleton instance for connection reuse
let runwareInstance: InstanceType<typeof Runware> | null = null;

/**
 * Get or create Runware SDK instance
 */
async function getRunwareInstance(): Promise<InstanceType<typeof Runware>> {
  if (!runwareInstance) {
    const apiKey = process.env.RUNWARE_API_KEY;
    
    if (!apiKey) {
      throw new Error('RUNWARE_API_KEY not set');
    }

    runwareInstance = new Runware({
      apiKey,
      shouldReconnect: true,
      globalMaxRetries: 3,
      timeoutDuration: 60000, // 60 second timeout
    });

    // Ensure connection is established
    await runwareInstance.ensureConnection();
    console.log('[Runware] SDK initialized and connected');
  }

  return runwareInstance;
}

/**
 * Generate an AI image using Runware SDK
 * @param prompt - The text prompt for image generation
 * @param seed - Optional seed for reproducible results (use random for unique images)
 * @returns The generated image URL
 */
export async function generateVaultNFTImage(
  prompt: string,
  seed?: number
): Promise<string> {
  const apiKey = process.env.RUNWARE_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️  RUNWARE_API_KEY not set, falling back to placeholder image');
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${Date.now()}`;
  }

  try {
    // Generate random seed if not provided (for unique images)
    const imageSeed = seed || Math.floor(Math.random() * 1000000);
    
    console.log(`[Runware] Generating image with prompt: "${prompt}" (seed: ${imageSeed})`);

    // Get SDK instance
    const runware = await getRunwareInstance();

    // Request image generation
    const images = await runware.requestImages({
      positivePrompt: prompt,
      negativePrompt: 'blurry, low quality, distorted, ugly, text, watermark',
      model: 'runware:101@1',
      width: 512,
      height: 512,
      numberResults: 1,
      seed: imageSeed,
    });

    if (images && images.length > 0 && images[0].imageURL) {
      const imageUrl = images[0].imageURL;
      console.log(`[Runware] ✅ Image generated successfully: ${imageUrl}`);
      return imageUrl;
    }

    throw new Error('No image URL in response');
  } catch (error: any) {
    console.error('[Runware] Failed to generate image:', error.message);
    
    // Fallback to dicebear if Runware fails
    const fallbackUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${Date.now()}`;
    console.log(`[Runware] Using fallback image: ${fallbackUrl}`);
    return fallbackUrl;
  }
}

/**
 * Generate a vault-themed prompt based on vault metadata
 * @param _vaultName - The name of the vault (reserved for future use)
 * @param vaultDescription - Optional description
 * @param ownershipPercentage - Ownership percentage (0-100)
 * @returns A descriptive prompt for image generation
 */
export function generateVaultPrompt(
  _vaultName: string,
  vaultDescription?: string,
  ownershipPercentage?: number
): string {
  // Create a dynamic prompt based on vault characteristics
  const themes = [
    'digital financial asset',
    'blockchain vault visualization',
    'cryptocurrency portfolio representation',
    'DeFi investment illustration',
    'smart contract visualization',
    'tokenized asset artwork',
    'financial technology art',
  ];

  const styles = [
    'modern minimalist',
    'futuristic abstract',
    'geometric pattern',
    'holographic gradient',
    'neon cyberpunk',
    'elegant professional',
    'clean tech aesthetic',
  ];

  const colors = [
    'blue and purple tones',
    'gold and cyan accents',
    'emerald and sapphire hues',
    'orange and teal gradient',
    'violet and mint colors',
    'rose gold and silver',
    'electric blue and magenta',
  ];

  // Pick random elements for variety
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];

  let prompt = `${style} ${theme} with ${color}`;

  // Add ownership context if provided
  if (ownershipPercentage && ownershipPercentage > 0) {
    if (ownershipPercentage >= 50) {
      prompt += ', prominent and bold design';
    } else if (ownershipPercentage >= 25) {
      prompt += ', balanced composition';
    } else {
      prompt += ', refined and subtle details';
    }
  }

  // Add additional context from vault name/description
  if (vaultDescription && vaultDescription.toLowerCase().includes('stable')) {
    prompt += ', stable and secure appearance';
  } else if (vaultDescription && vaultDescription.toLowerCase().includes('growth')) {
    prompt += ', dynamic and ascending elements';
  } else if (vaultDescription && vaultDescription.toLowerCase().includes('risk')) {
    prompt += ', bold and energetic composition';
  }

  prompt += ', high quality, professional artwork, 8k resolution';

  return prompt;
}
