// T045: Transaction approval flow with clear details display
// Purpose: Show transaction details before approval and handle signing

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AlertCircle, CheckCircle, Shield, Clock, Coins, FileText } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';

interface TransactionOperation {
  type: string;
  source?: string;
  destination?: string;
  asset?: {
    code: string;
    issuer?: string;
  };
  amount?: string;
  [key: string]: any;
}

interface TransactionDetails {
  operations: TransactionOperation[];
  fee: string;
  memo?: string;
  source: string;
  network: string;
}

interface TransactionApprovalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionDetails | null;
  onApprove: () => Promise<void>;
  onReject?: () => void;
}

export const TransactionApproval = ({
  isOpen,
  onClose,
  transaction,
  onApprove,
  onReject,
}: TransactionApprovalProps) => {
  const { address } = useWallet();
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);

    try {
      await onApprove();
      onClose();
    } catch (err: any) {
      console.error('Transaction approval error:', err);
      
      let errorMessage = 'Transaction failed. ';
      
      if (err.message?.includes('User rejected')) {
        errorMessage += 'You rejected the transaction.';
      } else if (err.message?.includes('insufficient')) {
        errorMessage += 'Insufficient balance to complete transaction.';
      } else if (err.message?.includes('timeout')) {
        errorMessage += 'Transaction timed out.';
      } else {
        errorMessage += err.message || 'An unexpected error occurred.';
      }
      
      setError(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = () => {
    if (onReject) {
      onReject();
    }
    onClose();
  };

  if (!transaction) return null;

  const getOperationDisplay = (op: TransactionOperation) => {
    switch (op.type) {
      case 'payment':
        return {
          icon: <Coins className="w-5 h-5" />,
          title: 'Payment',
          details: [
            { label: 'To', value: op.destination || 'Unknown' },
            { label: 'Amount', value: `${op.amount || '0'} ${op.asset?.code || 'XLM'}` },
          ],
        };
      
      case 'createAccount':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          title: 'Create Account',
          details: [
            { label: 'Destination', value: op.destination || 'Unknown' },
            { label: 'Starting Balance', value: `${op.startingBalance || '0'} XLM` },
          ],
        };
      
      case 'changeTrust':
        return {
          icon: <Shield className="w-5 h-5" />,
          title: 'Add Trustline',
          details: [
            { label: 'Asset', value: op.asset?.code || 'Unknown' },
            { label: 'Issuer', value: op.asset?.issuer ? `${op.asset.issuer.slice(0, 8)}...` : 'Unknown' },
            { label: 'Limit', value: op.limit || 'Unlimited' },
          ],
        };
      
      case 'manageData':
        return {
          icon: <FileText className="w-5 h-5" />,
          title: 'Manage Data',
          details: [
            { label: 'Name', value: op.name || 'Unknown' },
            { label: 'Value', value: op.value ? 'Set' : 'Remove' },
          ],
        };
      
      default:
        return {
          icon: <FileText className="w-5 h-5" />,
          title: op.type || 'Unknown Operation',
          details: [
            { label: 'Type', value: op.type || 'Unknown' },
          ],
        };
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleReject} title="Approve Transaction">
      <div className="space-y-6">
        {/* Warning banner */}
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-300">
              <p className="font-semibold mb-1">Review carefully</p>
              <p>Make sure you trust this transaction before approving.</p>
            </div>
          </div>
        </div>

        {/* Transaction source */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span>Source Account</span>
          </div>
          <p className="font-mono text-sm text-white break-all">
            {transaction.source}
          </p>
          {transaction.source === address && (
            <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              <span>Your connected wallet</span>
            </div>
          )}
        </div>

        {/* Operations */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase">Operations</h3>
          {transaction.operations.map((op, index) => {
            const display = getOperationDisplay(op);
            
            return (
              <div key={index} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                    {display.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{display.title}</div>
                    <div className="text-xs text-gray-500">Operation {index + 1}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {display.details.map((detail, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-400">{detail.label}:</span>
                      <span className="text-white font-mono break-all ml-2">{detail.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fee and memo */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Network Fee:</span>
            <span className="text-white font-semibold">{transaction.fee} stroops</span>
          </div>
          
          {transaction.memo && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Memo:</span>
              <span className="text-white font-mono">{transaction.memo}</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Network:</span>
            <span className="text-white">{transaction.network}</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            fullWidth
            onClick={handleReject}
            disabled={isApproving}
          >
            Reject
          </Button>
          <Button
            variant="gradient"
            fullWidth
            onClick={handleApprove}
            isLoading={isApproving}
          >
            Approve Transaction
          </Button>
        </div>

        {/* Security notice */}
        <div className="text-xs text-gray-500 text-center">
          Your wallet extension will ask you to sign this transaction
        </div>
      </div>
    </Modal>
  );
};
