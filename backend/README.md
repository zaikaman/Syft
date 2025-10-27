# Syft Backend API

Backend service for the Syft DeFi Yield Vault Platform built with Express, TypeScript, and Supabase.

## Tech Stack

- **Node.js** + **Express** - REST API server
- **TypeScript** - Type-safe development
- **Supabase** - PostgreSQL database and real-time subscriptions
- **Stellar SDK** - Blockchain interaction via Horizon
- **OpenAI API** - AI-powered strategy optimization
- **Prophet** - Time-series forecasting (optional)

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- OpenAI API key (for AI features)
- Stellar network access (Futurenet recommended for development)

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```bash
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STELLAR_HORIZON_URL=https://horizon-futurenet.stellar.org

# Optional (for AI features)
OPENAI_API_KEY=your_openai_key

# Optional (for sentiment analysis)
TWITTER_BEARER_TOKEN=your_twitter_token
REDDIT_CLIENT_ID=your_reddit_id
REDDIT_CLIENT_SECRET=your_reddit_secret
```

### 3. Database Setup

Run the Supabase migrations (see `../docs/database-setup.md` for SQL schemas).

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── lib/                  # Shared utilities
│   │   ├── supabase.ts       # Supabase client
│   │   ├── horizonClient.ts  # Stellar Horizon client
│   │   └── openaiClient.ts   # OpenAI client
│   ├── middleware/           # Express middleware
│   │   ├── errorHandler.ts  # Error handling
│   │   ├── logger.ts         # Request logging
│   │   └── cors.ts           # CORS configuration
│   ├── routes/               # API routes
│   │   ├── vaults.ts         # Vault endpoints
│   │   ├── wallet.ts         # Wallet endpoints
│   │   ├── backtests.ts      # Backtest endpoints
│   │   ├── suggestions.ts    # AI suggestion endpoints
│   │   ├── nfts.ts           # NFT endpoints
│   │   └── marketplace.ts    # Marketplace endpoints
│   └── services/             # Business logic
│       ├── vaultDeploymentService.ts
│       ├── vaultMonitorService.ts
│       ├── ruleTriggerService.ts
│       ├── backtestEngine.ts
│       └── sentimentAnalysisService.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Vaults
- `POST /api/vaults` - Deploy new vault
- `GET /api/vaults/:vaultId` - Get vault state
- `POST /api/vaults/:vaultId/deposit` - Deposit to vault
- `POST /api/vaults/:vaultId/withdraw` - Withdraw from vault
- `GET /api/vaults/:vaultId/history` - Get transaction history

### Wallet
- `GET /api/wallet/:address/assets` - Get wallet assets and balances

### Backtests
- `POST /api/backtests` - Run backtest simulation
- `GET /api/backtests/:backtestId` - Get backtest results

### AI Suggestions
- `POST /api/vaults/:vaultId/suggestions` - Generate AI suggestions

### NFTs & Marketplace
- `POST /api/vaults/:vaultId/nft` - Mint vault NFT
- `GET /api/marketplace/listings` - Browse marketplace
- `POST /api/marketplace/listings` - Create listing
- `POST /api/marketplace/purchase` - Purchase NFT

## Development

### Error Handling

All routes should use the `asyncHandler` wrapper and throw appropriate errors:

```typescript
import { asyncHandler, NotFoundError } from '../middleware/errorHandler';

router.get('/vaults/:id', asyncHandler(async (req, res) => {
  const vault = await getVault(req.params.id);
  if (!vault) {
    throw new NotFoundError('Vault not found');
  }
  res.json({ success: true, data: vault });
}));
```

### API Response Format

All API responses follow this format:

```typescript
{
  "success": boolean,
  "data": any,
  "error": {
    "message": string,
    "code": string,
    "details": any
  },
  "timestamp": string
}
```

## Testing

```bash
# Run manual tests
npm run test

# Test with curl
curl http://localhost:3001/health
```

## Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel --prod`

### Docker

```bash
docker build -t syft-backend .
docker run -p 3001:3001 --env-file .env syft-backend
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Environment (development/production) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `STELLAR_HORIZON_URL` | Yes | Stellar Horizon endpoint |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features |
| `TWITTER_BEARER_TOKEN` | No | Twitter API bearer token |
| `REDDIT_CLIENT_ID` | No | Reddit API client ID |
| `CORS_ORIGINS` | No | Allowed CORS origins (comma-separated) |

## License

MIT
