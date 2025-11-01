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
 * @returns A descriptive prompt for image generation
 */
export function generateVaultPrompt(
  _vaultName: string,
  vaultDescription?: string,
  _ownershipPercentage?: number // Deprecated parameter, kept for backward compatibility
): string {
  // Vault-specific imagery themes
  const vaultTypes = [
    'futuristic digital bank vault with glowing security panels',
    'high-tech crypto vault with holographic locks',
    'massive treasure vault filled with digital gold coins',
    'secure underground vault with reinforced steel doors',
    'cyberpunk vault with neon security systems',
    'elegant safe deposit vault with golden accents',
    'modern vault interior with digital security screens',
    'ancient-meets-future vault with blockchain patterns',
  ];

  const vaultDetails = [
    'heavy circular vault door with combination locks',
    'biometric security scanners and LED displays',
    'stacked crypto tokens and digital assets inside',
    'laser security grids and holographic barriers',
    'reinforced titanium walls with glowing circuits',
    'secure storage compartments with digital interfaces',
    'blockchain symbols etched on vault surfaces',
    'rotating vault mechanisms and security keys',
  ];

  const atmospheres = [
    'dramatic lighting from above',
    'cool blue security lights',
    'golden warm glow from treasure inside',
    'neon cyan and purple accents',
    'high contrast dramatic shadows',
    'clean professional lighting',
    'mystical ethereal glow',
    'electric energy radiating outward',
  ];

  const colors = [
    'metallic silver and gold',
    'deep blue with electric cyan highlights',
    'dark grey with golden accents',
    'black with neon green security lights',
    'bronze and copper tones',
    'chrome and holographic rainbow',
    'midnight blue with white LEDs',
    'gunmetal grey with orange alerts',
  ];

  // Pick random elements for variety
  const vaultType = vaultTypes[Math.floor(Math.random() * vaultTypes.length)];
  const detail = vaultDetails[Math.floor(Math.random() * vaultDetails.length)];
  const atmosphere = atmospheres[Math.floor(Math.random() * atmospheres.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];

  let prompt = `${vaultType}, featuring ${detail}, ${atmosphere}, ${color}`;

  // Add additional context from vault name/description
  if (vaultDescription && vaultDescription.toLowerCase().includes('stable')) {
    prompt += ', fortress-like stability and strength';
  } else if (vaultDescription && vaultDescription.toLowerCase().includes('growth')) {
    prompt += ', overflowing with increasing assets';
  } else if (vaultDescription && vaultDescription.toLowerCase().includes('risk')) {
    prompt += ', high-security vault with alert systems active';
  }

  prompt += ', cinematic composition, ultra detailed, 8k quality, professional digital art';

  return prompt;
}
