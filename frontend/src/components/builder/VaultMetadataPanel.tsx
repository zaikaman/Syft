import { motion } from 'framer-motion';
import { Type, AlignLeft, Eye, EyeOff } from 'lucide-react';

interface VaultMetadataPanelProps {
  name: string;
  description: string;
  isPublic: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onVisibilityChange: (isPublic: boolean) => void;
}

const VaultMetadataPanel = ({
  name,
  description,
  isPublic,
  onNameChange,
  onDescriptionChange,
  onVisibilityChange,
}: VaultMetadataPanelProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-secondary border-b border-default px-4 py-3"
    >
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vault Name */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-400 mb-1.5">
              <Type className="w-3.5 h-3.5" />
              Vault Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="My Awesome Vault"
              maxLength={100}
              className="w-full px-3 py-2 bg-neutral-900 border border-default rounded-lg text-neutral-50 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Visibility Toggle */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-400 mb-1.5">
              {isPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Visibility
            </label>
            <button
              onClick={() => onVisibilityChange(!isPublic)}
              className={`
                w-full px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${isPublic 
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50 hover:bg-primary-500/30' 
                  : 'bg-neutral-900 text-neutral-400 border border-default hover:bg-neutral-800'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                {isPublic ? (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Public</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>Private</span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Description */}
          <div className="md:col-span-3">
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-400 mb-1.5">
              <AlignLeft className="w-3.5 h-3.5" />
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Describe your vault strategy and goals..."
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 bg-neutral-900 border border-default rounded-lg text-neutral-50 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-neutral-500">
                {isPublic ? 'This will be visible on the marketplace' : 'Only visible to you'}
              </span>
              <span className="text-xs text-neutral-500">
                {description.length}/500
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VaultMetadataPanel;
