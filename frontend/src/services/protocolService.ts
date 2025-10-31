// Protocol service for managing DeFi protocol integrations
import type { Network } from '../types/network';

export interface ProtocolInfo {
  id: string;
  name: string;
  description: string;
  type: 'dex' | 'lending' | 'staking' | 'liquidity';
  networks: Network[];
  contractAddress?: Record<Network, string>;
  website?: string;
  docs?: string;
  icon?: string;
}

/**
 * Get all available protocols for a given network
 */
export async function getProtocolsForNetwork(network: Network = 'testnet'): Promise<ProtocolInfo[]> {
  const allProtocols = getProtocolRegistry();
  return allProtocols.filter((protocol) => protocol.networks.includes(network));
}

/**
 * Get protocols by type
 */
export async function getProtocolsByType(
  type: ProtocolInfo['type'],
  network: Network = 'testnet'
): Promise<ProtocolInfo[]> {
  const protocols = await getProtocolsForNetwork(network);
  return protocols.filter((p) => p.type === type);
}

/**
 * Get protocol by ID
 */
export async function getProtocolById(id: string): Promise<ProtocolInfo | null> {
  const protocols = getProtocolRegistry();
  return protocols.find((p) => p.id === id) || null;
}

/**
 * Search protocols by name
 */
export async function searchProtocols(
  query: string,
  network: Network = 'testnet'
): Promise<ProtocolInfo[]> {
  const protocols = await getProtocolsForNetwork(network);
  const queryLower = query.toLowerCase();
  
  return protocols.filter(
    (protocol) =>
      protocol.name.toLowerCase().includes(queryLower) ||
      protocol.description.toLowerCase().includes(queryLower)
  );
}

/**
 * Protocol registry with known Stellar DeFi protocols
 */
function getProtocolRegistry(): ProtocolInfo[] {
  return [
    {
      id: 'soroswap',
      name: 'Soroswap',
      description: 'Decentralized exchange on Stellar',
      type: 'dex',
      networks: ['testnet', 'futurenet', 'mainnet'],
      contractAddress: {
        testnet: process.env.PUBLIC_SOROSWAP_ROUTER_TESTNET || '',
        futurenet: process.env.PUBLIC_SOROSWAP_ROUTER_FUTURENET || '',
        mainnet: process.env.PUBLIC_SOROSWAP_ROUTER_MAINNET || '',
      },
      website: 'https://soroswap.finance',
      docs: 'https://docs.soroswap.finance',
    },
    {
      id: 'aquarius',
      name: 'Aquarius',
      description: 'Liquidity protocol and AMM',
      type: 'liquidity',
      networks: ['testnet', 'mainnet'],
      website: 'https://aqua.network',
    },
    {
      id: 'blend',
      name: 'Blend',
      description: 'Lending and borrowing protocol',
      type: 'lending',
      networks: ['testnet', 'mainnet'],
      website: 'https://blend.capital',
    },
    {
      id: 'phoenix',
      name: 'Phoenix',
      description: 'DeFi hub and liquidity protocol',
      type: 'dex',
      networks: ['testnet', 'mainnet'],
      website: 'https://phoenix-hub.io',
    },
    {
      id: 'script3',
      name: 'Script3',
      description: 'Liquid staking protocol',
      type: 'staking',
      networks: ['testnet', 'mainnet'],
      website: 'https://script3.io',
    },
    {
      id: 'comet',
      name: 'Comet',
      description: 'Yield optimization protocol',
      type: 'staking',
      networks: ['testnet', 'mainnet'],
    },
  ];
}

/**
 * Get protocol contract address for specific network
 */
export async function getProtocolContractAddress(
  protocolId: string,
  network: Network
): Promise<string | null> {
  const protocol = await getProtocolById(protocolId);
  if (!protocol || !protocol.contractAddress) return null;
  
  return protocol.contractAddress[network] || null;
}
