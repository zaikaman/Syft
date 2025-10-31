import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Coins, Search, CheckCircle } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { AssetBlock as AssetBlockType } from '../../../types/blocks';
import { searchTokens, validateTokenContract, type TokenInfo } from '../../../services/assetService';
import { useWallet } from '../../../providers/WalletProvider';

interface AssetBlockProps {
  id: string;
  data: AssetBlockType['data'];
  selected?: boolean;
}

const AssetBlock = ({ id, data, selected }: AssetBlockProps) => {
  const { assetType, assetCode, allocation, icon } = data;
  const { updateNodeData } = useReactFlow();
  const { network } = useWallet();
  
  const [localAllocation, setLocalAllocation] = useState(allocation);
  const [localAssetCode, setLocalAssetCode] = useState(assetCode || '');
  const [localAssetIssuer, setLocalAssetIssuer] = useState(data.assetIssuer || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Sync local state with data prop when it changes externally
  useEffect(() => {
    setLocalAllocation(allocation);
  }, [allocation]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search tokens as user types
  useEffect(() => {
    if (assetType === 'CUSTOM' && searchQuery.length >= 2) {
      const delaySearch = setTimeout(async () => {
        const results = await searchTokens(searchQuery, network as any);
        setSearchResults(results);
        setShowSearchResults(true);
      }, 300);

      return () => clearTimeout(delaySearch);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery, assetType, network]);

  // Validate contract address when it changes
  useEffect(() => {
    if (assetType === 'CUSTOM' && localAssetIssuer && localAssetIssuer.startsWith('C')) {
      const delayValidation = setTimeout(async () => {
        setIsValidating(true);
        const result = await validateTokenContract(localAssetIssuer, network as any);
        setIsValid(result.valid);
        
        // Auto-populate symbol if validated successfully
        if (result.valid && result.token && !localAssetCode) {
          setLocalAssetCode(result.token.symbol);
          updateNodeData(id, { assetCode: result.token.symbol });
        }
        
        setIsValidating(false);
      }, 500);

      return () => clearTimeout(delayValidation);
    } else {
      setIsValid(null);
    }
  }, [localAssetIssuer, assetType, network, localAssetCode, id, updateNodeData]);

  const handleAllocationChange = useCallback((value: number) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    setLocalAllocation(clampedValue);
    updateNodeData(id, { allocation: clampedValue });
  }, [id, updateNodeData]);

  const handleAssetCodeChange = useCallback((value: string) => {
    setLocalAssetCode(value);
    updateNodeData(id, { assetCode: value });
  }, [id, updateNodeData]);

  const handleAssetIssuerChange = useCallback((value: string) => {
    setLocalAssetIssuer(value);
    updateNodeData(id, { assetIssuer: value });
  }, [id, updateNodeData]);

  const handleTokenSelect = useCallback((token: TokenInfo) => {
    setLocalAssetCode(token.symbol);
    setLocalAssetIssuer(token.address || token.issuer || '');
    setSearchQuery('');
    setShowSearchResults(false);
    
    updateNodeData(id, { 
      assetCode: token.symbol,
      assetIssuer: token.address || token.issuer || '',
    });
  }, [id, updateNodeData]);

  const displayName = assetType === 'CUSTOM' && assetCode ? assetCode : assetType;

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 
        border-2 rounded-lg shadow-lg 
        min-w-[240px] p-4
        transition-all duration-200
        ${selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 dark:border-gray-600'}
        hover:shadow-xl
      `}
    >
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-green-500 !w-3 !h-3"
        id="asset-out"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {icon ? (
          <img src={icon} alt={displayName} className="w-6 h-6 rounded-full" />
        ) : (
          <Coins className="w-6 h-6 text-blue-500" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {displayName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Asset</p>
        </div>
      </div>

      {/* Custom token inputs */}
      {assetType === 'CUSTOM' && (
        <div className="space-y-2 mb-3">
          {/* Token Search */}
          <div className="relative" ref={searchRef}>
            <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
              Search Token
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or symbol..."
                className="w-full pl-7 pr-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg max-h-40 overflow-y-auto">
                {searchResults.map((token) => (
                  <button
                    key={token.address || token.symbol}
                    onClick={() => handleTokenSelect(token)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{token.symbol}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{token.name}</div>
                    </div>
                    <span className="text-xs text-gray-400">{token.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Token Symbol (Manual Entry) */}
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
              Token Symbol
            </label>
            <input
              type="text"
              value={localAssetCode}
              onChange={(e) => handleAssetCodeChange(e.target.value)}
              placeholder="e.g. AQUA, USDC"
              className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
          
          {/* Contract Address with Validation */}
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1 flex items-center justify-between">
              <span>Contract Address (Soroban) or Issuer (Classic)</span>
              {isValidating && <span className="text-[10px] text-yellow-500">Validating...</span>}
              {isValid === true && <CheckCircle className="w-3 h-3 text-green-500" />}
              {isValid === false && <span className="text-[10px] text-red-500">Invalid</span>}
            </label>
            <input
              type="text"
              value={localAssetIssuer}
              onChange={(e) => handleAssetIssuerChange(e.target.value)}
              placeholder="C... (56 chars) or G... (Classic)"
              className={`w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border rounded focus:outline-none focus:ring-2 text-gray-900 dark:text-white font-mono ${
                isValid === false 
                  ? 'border-red-500 focus:ring-red-500' 
                  : isValid === true
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500'
              }`}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 Use 'C' address for Soroban tokens
            </p>
          </div>
        </div>
      )}

      {/* Allocation controls */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Allocation:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={localAllocation}
              onChange={(e) => handleAllocationChange(parseFloat(e.target.value) || 0)}
              className="w-16 px-2 py-1 text-sm text-right bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              %
            </span>
          </div>
        </div>

        {/* Allocation slider */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={localAllocation}
          onChange={(e) => handleAllocationChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${localAllocation}%, #e5e7eb ${localAllocation}%, #e5e7eb 100%)`
          }}
        />

        {/* Quick allocation buttons */}
        <div className="flex gap-1">
          {[25, 50, 75, 100].map((value) => (
            <button
              key={value}
              onClick={() => handleAllocationChange(value)}
              className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors text-gray-900 dark:text-white"
            >
              {value}%
            </button>
          ))}
        </div>
      </div>

      {/* Custom token info display */}
      {assetType === 'CUSTOM' && localAssetIssuer && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Issuer: {localAssetIssuer.slice(0, 8)}...{localAssetIssuer.slice(-8)}
          </p>
        </div>
      )}
    </div>
  );
};

export default AssetBlock;
