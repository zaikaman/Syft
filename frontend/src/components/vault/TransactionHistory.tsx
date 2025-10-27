import React, { useEffect, useState } from 'react';

interface Transaction {
  hash: string;
  createdAt: string;
  operations: number;
  successful: boolean;
}

interface TransactionHistoryProps {
  vaultId: string;
  limit?: number;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  vaultId,
  limit = 50,
}) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `http://localhost:3001/api/vaults/${vaultId}/history?limit=${limit}`
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch transaction history');
        }

        setTransactions(data.data.transactions || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load transaction history'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [vaultId, limit]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">Transaction History</h2>

      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {tx.hash.substring(0, 8)}...{tx.hash.substring(tx.hash.length - 8)}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        tx.successful
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {tx.successful ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-sm text-gray-600">
                    <span>{tx.operations} operation(s)</span>
                    <span>
                      {new Date(tx.createdAt).toLocaleDateString()}{' '}
                      {new Date(tx.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <a
                  href={`https://stellar.expert/explorer/futurenet/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
