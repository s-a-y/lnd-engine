const grpc = require('grpc')

const { genSeed } = require('../lnd-actions')
const isAvailable = require('./is-available')

/**
 * CODE 12 for gRPC is equal to 'unimplemented'
 *
 * @see https://github.com/grpc/grpc-go/blob/master/codes/codes.go
 * @constant
 * @type {Number}
 * @default
 */
const UNIMPLEMENTED_SERVICE_CODE = grpc.status.UNIMPLEMENTED

/**
 * @constant
 * @type {String}
 * @default
 */
const WALLET_EXISTS_ERROR_MESSAGE = 'wallet already exists'

/**
 * Rough estimate if the engine's node unlocked or not. Sets the `unlocked` flag
 * on an engine.
 *
 * States of the Engine:
 * - Locked - First-time use or engine requires a password to have access to funds
 * - Unlocked - engine is fully functional and ready to accept requests
 *
 * @function
 * @return {Boolean}
 */
async function isEngineUnlocked () {
  try {
    // If the call to `genSeed` succeeds, there will be two possible states that
    // an engine could be in:
    // 1. The engine is locked and the user needs to either create a wallet or unlock the wallet
    // 2. The engine has been unlocked during an exponential backoff, in which case
    //    the WalletUnlocked RPC is still available
    await genSeed({ client: this.walletUnlocker })
  } catch (e) {
    // In gRPC, "unimplemented" indicates that an operation is not implemented or not
    // supported/enabled in this specific service. In our case, this means the
    // WalletUnlocker RPC has never been started and the Lightning RPC is functional
    //
    // This state happens when an engine is being used in development mode (noseedbackup)
    if (e.code === UNIMPLEMENTED_SERVICE_CODE) {
      return true
    }

    // The call to 'genSeeds', which will return `wallet already exists` for
    // any state (locked or unlocked) on the engine.
    //
    // If we receive a `wallet already exists` error, then one of two things
    // may be happening:
    //
    // 1. The user just restarted their node and the engine is now locked
    // 2. The user has successfully unlocked their engine but are waiting
    //    for re-validation of the engine
    //
    // In the first case (#1), if we receive `wallet already exists` AND lnrpc (Lightning RPC)
    // is not implemented, we can safely assume that the engine is still locked.
    //
    // If the error exists AND lnrpc (Lightning RPC) is available, we can assume
    // that the engine is unlocked
    //
    // Unfortunately, we have to string match on the error since the error code
    // returned is generic (code 2)
    if (e.message && e.message.includes(WALLET_EXISTS_ERROR_MESSAGE)) {
      // At this point, `genSeed` has returns a `wallet already exists` error message
      // however we still don't know if the engine is locked or unlocked because this
      // error message is returned for any state.
      try {
        await isAvailable.call(this)
      } catch (e) {
        // If a 'wallet already exists', but lnrpc (Lighting RPC) is not implemented
        // then the engine is still locked and the user needs to unlock the wallet
        if (e.code === UNIMPLEMENTED_SERVICE_CODE) {
          return false
        }
      }

      return true
    }

    // Rethrow the error since the user will now need to troubleshoot the engine
    throw e
  }

  return false
}

module.exports = isEngineUnlocked
