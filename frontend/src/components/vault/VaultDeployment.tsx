import React, { useState } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { FeeEstimator } from './FeeEstimator';

interface VaultConfig {
  name: string;
  assets: string[];
  rules: Array<{
    condition_type: string;
    threshold: number;
    action: string;
    target_allocation: number[];
  }>;
}

interface VaultDeploymentProps {
  config: VaultConfig;
  onDeploySuccess?: (vaultId: string, contractAddress: string) => void;
  onDeployError?: (error: string) => void;
}

export const VaultDeployment: React.FC<VaultDeploymentProps> = ({
  config,
  onDeploySuccess,
  onDeployError,
}) => {
  const { address } = useWallet();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleDeploy = async () => {
    if (!address) {
      const errorMsg = 'Please connect your wallet first';
      setError(errorMsg);
      onDeployError?.(errorMsg);
      return;
    }

    setIsDeploying(true);
    setError('');
    setDeploymentStatus('Preparing deployment...');

    try {
      // Get private key from user (in production, this would use wallet signing)
      const privateKey = prompt(
        'Enter your private key (for MVP demo only - in production this will use wallet signing):'
      );

      if (!privateKey) {
        throw new Error('Private key required for deployment');
      }

      setDeploymentStatus('Deploying vault contract...');

      // Call backend API to deploy vault
      const response = await fetch('http://localhost:3001/api/vaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            owner: address,
            name: config.name,
            assets: config.assets,
            rules: config.rules,
          },
          privateKey,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to deploy vault');
      }

      setDeploymentStatus('Vault deployed successfully!');
      onDeploySuccess?.(data.data.vaultId, data.data.contractAddress);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to deploy vault';
      setError(errorMsg);
      setDeploymentStatus('');
      onDeployError?.(errorMsg);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="vault-deployment">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Deploy Vault</h2>

        {/* Vault Configuration Summary */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Configuration Summary</h3>
          <div className="bg-gray-50 rounded p-4 space-y-2">
            <div>
              <span className="font-medium">Name:</span> {config.name}
            </div>
            <div>
              <span className="font-medium">Assets:</span>{' '}
              {config.assets.join(', ')}
            </div>
            <div>
              <span className="font-medium">Rules:</span> {config.rules.length}{' '}
              rule(s) configured
            </div>
          </div>
        </div>

        {/* Fee Estimation */}
        <FeeEstimator />

        {/* Deployment Status */}
        {deploymentStatus && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800">{deploymentStatus}</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Deploy Button */}
        <button
          onClick={handleDeploy}
          disabled={isDeploying || !address}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
            isDeploying || !address
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isDeploying ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Deploying...
            </span>
          ) : (
            'Deploy Vault'
          )}
        </button>

        {!address && (
          <p className="mt-4 text-sm text-gray-600 text-center">
            Please connect your wallet to deploy a vault
          </p>
        )}
      </div>
    </div>
  );
};
