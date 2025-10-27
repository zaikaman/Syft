import React, { useEffect, useState } from 'react';

export const FeeEstimator: React.FC = () => {
  const [fees, setFees] = useState<{
    baseFee: string;
    estimatedFee: string;
    estimatedCost: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const response = await fetch(
          'http://localhost:3001/api/vaults/estimate-fees',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await response.json();

        if (data.success) {
          setFees(data.data);
        }
      } catch (error) {
        console.error('Error fetching fee estimation:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFees();
  }, []);

  if (loading) {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Estimated Fees</h3>
        <div className="bg-gray-50 rounded p-4">
          <p className="text-gray-600">Loading fee estimation...</p>
        </div>
      </div>
    );
  }

  if (!fees) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">Estimated Fees</h3>
      <div className="bg-gray-50 rounded p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-700">Base Fee:</span>
          <span className="font-medium">{fees.baseFee} stroops</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-700">Estimated Total:</span>
          <span className="font-medium">{fees.estimatedFee} stroops</span>
        </div>
        <div className="flex justify-between border-t pt-2 mt-2">
          <span className="text-gray-900 font-semibold">Cost in XLM:</span>
          <span className="font-bold text-blue-600">{fees.estimatedCost} XLM</span>
        </div>
      </div>
    </div>
  );
};
