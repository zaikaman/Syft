import { useParams } from 'react-router-dom';
import { VaultDetail as VaultDetailComponent } from '../components/marketplace/VaultDetail';

const VaultDetail = () => {
  const { vaultId } = useParams<{ vaultId: string }>();

  if (!vaultId) {
    return (
      <div className="min-h-screen pt-16 pb-12 bg-app">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-2 text-neutral-50">
              Vault Not Found
            </h2>
            <p className="text-neutral-400">
              The requested vault could not be found.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-12 bg-app">
      <div className="container mx-auto px-4 max-w-6xl">
        <VaultDetailComponent vaultId={vaultId} />
      </div>
    </div>
  );
};

export default VaultDetail;
