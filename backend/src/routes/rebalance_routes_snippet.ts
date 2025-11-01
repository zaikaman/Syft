// ADD THESE ROUTES TO vaults.ts after the submit-deposit route (around line 1087)

/**
 * POST /api/vaults/:vaultId/build-rebalance
 * Build unsigned rebalance transaction for user to sign
 */
router.post('/:vaultId/build-rebalance', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { userAddress, network } = req.body;

    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userAddress',
      });
    }

    // Get vault from database
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found',
      });
    }

    const servers = getNetworkServers(network);
    const userAccount = await servers.horizonServer.loadAccount(userAddress);

    // Build transaction to call trigger_rebalance
    const contract = new StellarSdk.Contract(vault.contract_address);
    const operation = contract.call('trigger_rebalance');

    let transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: servers.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate transaction
    const simulationResponse = await servers.sorobanServer.simulateTransaction(transaction);
    
    if (StellarSdk.rpc.Api.isSimulationError(simulationResponse)) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    // Assemble transaction
    transaction = StellarSdk.rpc.assembleTransaction(transaction, simulationResponse).build();

    return res.json({
      success: true,
      data: {
        xdr: transaction.toXDR(),
        contractAddress: vault.contract_address,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/build-rebalance:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/vaults/:vaultId/submit-rebalance
 * Submit signed rebalance transaction
 */
router.post('/:vaultId/submit-rebalance', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { signedXDR, network } = req.body;

    if (!signedXDR) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: signedXDR',
      });
    }

    console.log(`[Submit Rebalance] Submitting signed rebalance transaction...`);

    const servers = getNetworkServers(network);
    const transaction = StellarSdk.TransactionBuilder.fromXDR(signedXDR, servers.networkPassphrase);
    
    const txResponse = await servers.horizonServer.submitTransaction(transaction);
    const txHash = txResponse.hash;

    console.log(`[Submit Rebalance] ✅ Transaction submitted successfully: ${txHash}`);

    // Invalidate cache and sync state
    const { data: vault } = await supabase
      .from('vaults')
      .select('contract_address')
      .eq('vault_id', vaultId)
      .single();

    if (vault?.contract_address) {
      invalidateVaultCache(vault.contract_address);
    }

    await syncVaultState(vaultId);

    return res.json({
      success: true,
      data: {
        transactionHash: txHash,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/vaults/:vaultId/submit-rebalance:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});
