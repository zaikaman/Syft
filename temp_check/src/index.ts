import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





export interface VaultConfig {
  assets: Array<string>;
  name: string;
  owner: string;
  router_address: Option<string>;
  rules: Array<RebalanceRule>;
}


export interface VaultState {
  last_rebalance: u64;
  total_shares: i128;
  total_value: i128;
}


export interface RebalanceRule {
  action: string;
  condition_type: string;
  target_allocation: Array<i128>;
  threshold: i128;
}


export interface UserPosition {
  last_deposit: u64;
  shares: i128;
}


export interface AssetBalance {
  amount: i128;
  token: string;
}

export const VaultError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"InsufficientBalance"},
  5: {message:"InsufficientShares"},
  6: {message:"InvalidAmount"},
  7: {message:"InvalidConfiguration"},
  8: {message:"RebalanceFailed"},
  9: {message:"TransferFailed"},
  10: {message:"NFTNotFound"},
  11: {message:"InvalidOwnership"},
  12: {message:"OwnershipExceeded"},
  13: {message:"SlippageTooHigh"},
  14: {message:"SwapFailed"},
  15: {message:"PoolNotFound"},
  16: {message:"InsufficientLiquidity"},
  17: {message:"RouterNotSet"}
}

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize a new vault
   */
  initialize: ({config}: {config: VaultConfig}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit assets into the vault (with optional auto-swap)
   * If deposit_token is different from base token, it will be swapped automatically
   */
  deposit: ({user, amount}: {user: string, amount: i128}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a deposit_with_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit with specific token (will auto-swap if not base asset)
   */
  deposit_with_token: ({user, amount, deposit_token}: {user: string, amount: i128, deposit_token: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw assets from the vault
   */
  withdraw: ({user, shares}: {user: string, shares: i128}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get vault state
   */
  get_state: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<VaultState>>

  /**
   * Construct and simulate a get_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get user position
   */
  get_position: ({user}: {user: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<UserPosition>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get vault configuration
   */
  get_config: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<VaultConfig>>>

  /**
   * Construct and simulate a set_router transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set router address for swaps (owner only)
   */
  set_router: ({router}: {router: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a trigger_rebalance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Trigger a rebalance based on configured rules (owner only)
   */
  trigger_rebalance: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAAC1ZhdWx0Q29uZmlnAAAAAAUAAAAAAAAABmFzc2V0cwAAAAAD6gAAABMAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADnJvdXRlcl9hZGRyZXNzAAAAAAPoAAAAEwAAAAAAAAAFcnVsZXMAAAAAAAPqAAAH0AAAAA1SZWJhbGFuY2VSdWxlAAAA",
        "AAAAAQAAAAAAAAAAAAAAClZhdWx0U3RhdGUAAAAAAAMAAAAAAAAADmxhc3RfcmViYWxhbmNlAAAAAAAGAAAAAAAAAAx0b3RhbF9zaGFyZXMAAAALAAAAAAAAAAt0b3RhbF92YWx1ZQAAAAAL",
        "AAAAAQAAAAAAAAAAAAAADVJlYmFsYW5jZVJ1bGUAAAAAAAAEAAAAAAAAAAZhY3Rpb24AAAAAABAAAAAAAAAADmNvbmRpdGlvbl90eXBlAAAAAAAQAAAAAAAAABF0YXJnZXRfYWxsb2NhdGlvbgAAAAAAA+oAAAALAAAAAAAAAAl0aHJlc2hvbGQAAAAAAAAL",
        "AAAAAQAAAAAAAAAAAAAADFVzZXJQb3NpdGlvbgAAAAIAAAAAAAAADGxhc3RfZGVwb3NpdAAAAAYAAAAAAAAABnNoYXJlcwAAAAAACw==",
        "AAAAAQAAAAAAAAAAAAAADEFzc2V0QmFsYW5jZQAAAAIAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAAAAABZJbml0aWFsaXplIGEgbmV3IHZhdWx0AAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAGY29uZmlnAAAAAAfQAAAAC1ZhdWx0Q29uZmlnAAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAAClZhdWx0RXJyb3IAAA==",
        "AAAAAAAAAIdEZXBvc2l0IGFzc2V0cyBpbnRvIHRoZSB2YXVsdCAod2l0aCBvcHRpb25hbCBhdXRvLXN3YXApCklmIGRlcG9zaXRfdG9rZW4gaXMgZGlmZmVyZW50IGZyb20gYmFzZSB0b2tlbiwgaXQgd2lsbCBiZSBzd2FwcGVkIGF1dG9tYXRpY2FsbHkAAAAAB2RlcG9zaXQAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAACwAAB9AAAAAKVmF1bHRFcnJvcgAA",
        "AAAAAAAAAD5EZXBvc2l0IHdpdGggc3BlY2lmaWMgdG9rZW4gKHdpbGwgYXV0by1zd2FwIGlmIG5vdCBiYXNlIGFzc2V0KQAAAAAAEmRlcG9zaXRfd2l0aF90b2tlbgAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAANZGVwb3NpdF90b2tlbgAAAAAAABMAAAABAAAD6QAAAAsAAAfQAAAAClZhdWx0RXJyb3IAAA==",
        "AAAAAAAAAB5XaXRoZHJhdyBhc3NldHMgZnJvbSB0aGUgdmF1bHQAAAAAAAh3aXRoZHJhdwAAAAIAAAAAAAAABHVzZXIAAAATAAAAAAAAAAZzaGFyZXMAAAAAAAsAAAABAAAD6QAAAAsAAAfQAAAAClZhdWx0RXJyb3IAAA==",
        "AAAAAAAAAA9HZXQgdmF1bHQgc3RhdGUAAAAACWdldF9zdGF0ZQAAAAAAAAAAAAABAAAH0AAAAApWYXVsdFN0YXRlAAA=",
        "AAAAAAAAABFHZXQgdXNlciBwb3NpdGlvbgAAAAAAAAxnZXRfcG9zaXRpb24AAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAfQAAAADFVzZXJQb3NpdGlvbg==",
        "AAAAAAAAABdHZXQgdmF1bHQgY29uZmlndXJhdGlvbgAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAtWYXVsdENvbmZpZwAAAAfQAAAAClZhdWx0RXJyb3IAAA==",
        "AAAAAAAAAClTZXQgcm91dGVyIGFkZHJlc3MgZm9yIHN3YXBzIChvd25lciBvbmx5KQAAAAAAAApzZXRfcm91dGVyAAAAAAABAAAAAAAAAAZyb3V0ZXIAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAApWYXVsdEVycm9yAAA=",
        "AAAAAAAAADpUcmlnZ2VyIGEgcmViYWxhbmNlIGJhc2VkIG9uIGNvbmZpZ3VyZWQgcnVsZXMgKG93bmVyIG9ubHkpAAAAAAARdHJpZ2dlcl9yZWJhbGFuY2UAAAAAAAAAAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAKVmF1bHRFcnJvcgAA",
        "AAAABAAAAAAAAAAAAAAAClZhdWx0RXJyb3IAAAAAABEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAADFVuYXV0aG9yaXplZAAAAAMAAAAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAABAAAAAAAAAASSW5zdWZmaWNpZW50U2hhcmVzAAAAAAAFAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABgAAAAAAAAAUSW52YWxpZENvbmZpZ3VyYXRpb24AAAAHAAAAAAAAAA9SZWJhbGFuY2VGYWlsZWQAAAAACAAAAAAAAAAOVHJhbnNmZXJGYWlsZWQAAAAAAAkAAAAAAAAAC05GVE5vdEZvdW5kAAAAAAoAAAAAAAAAEEludmFsaWRPd25lcnNoaXAAAAALAAAAAAAAABFPd25lcnNoaXBFeGNlZWRlZAAAAAAAAAwAAAAAAAAAD1NsaXBwYWdlVG9vSGlnaAAAAAANAAAAAAAAAApTd2FwRmFpbGVkAAAAAAAOAAAAAAAAAAxQb29sTm90Rm91bmQAAAAPAAAAAAAAABVJbnN1ZmZpY2llbnRMaXF1aWRpdHkAAAAAAAAQAAAAAAAAAAxSb3V0ZXJOb3RTZXQAAAAR" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
        deposit: this.txFromJSON<Result<i128>>,
        deposit_with_token: this.txFromJSON<Result<i128>>,
        withdraw: this.txFromJSON<Result<i128>>,
        get_state: this.txFromJSON<VaultState>,
        get_position: this.txFromJSON<UserPosition>,
        get_config: this.txFromJSON<Result<VaultConfig>>,
        set_router: this.txFromJSON<Result<void>>,
        trigger_rebalance: this.txFromJSON<Result<void>>
  }
}