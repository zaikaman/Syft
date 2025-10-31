import { useParams } from 'react-router-dom';
import { VaultDetail as VaultDetailComponent } from '../components/marketplace/VaultDetail';

const VaultDetail = () => {
  const { vaultId } = useParams<{ vaultId: string }>();

  if (!vaultId) {
    return (
      <div className="h-full bg-app flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-neutral-50">
            Vault Not Found
          </h2>
          <p className="text-neutral-400">
            The requested vault could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-app overflow-auto">
      <div className="container mx-auto px-4 py-8 pb-16 max-w-6xl">
        <VaultDetailComponent vaultId={vaultId} />
      </div>
    </div>
  );
};

export default VaultDetail;
