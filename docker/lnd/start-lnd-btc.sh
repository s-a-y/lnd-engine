#!/usr/bin/env bash

set -e

NODE=${NODE:-bitcoind}
CONFIG_FILE=/home/lnd/lnd.conf

# Simple check to make sure that the user has changed the external url of lnd_btc
# outside of regtest. This will cause unintended issues w/ routing through the relayer
if [[ "$NETWORK" != 'regtest' ]] && [[ "$EXTERNAL_ADDRESS" == *"sample.ip.address"* ]]; then
    echo "Your current external address for LND_BTC is set to an internal address. Please change this for $NETWORK"
    exit 1
fi

echo "LND BTC starting with network: $NETWORK $NODE"

PARAMS=$(echo \
    "--configfile=$CONFIG_FILE" \
    "--bitcoin.$NETWORK" \
    "--debuglevel=$DEBUG" \
    "--externalip=$EXTERNAL_ADDRESS" \
    "--extpreimage.rpchost=$EXTPREIMAGE_HOST" \
    "--$NODE.rpcuser=$RPC_USER" \
    "--$NODE.rpcpass=$RPC_PASS" \
    "--$NODE.rpchost=$RPC_HOST" \
    "--$NODE.zmqpubrawblock=$ZMQPUBRAWBLOCK" \
    "--$NODE.zmqpubrawtx=$ZMQPUBRAWTX"
)

if [[ -n "$LND_BASE_FEE" ]]; then
    echo "Setting custom base fee for bitcoin: $LND_BASE_FEE"
    PARAMS="$PARAMS --bitcoin.basefee=$LND_BASE_FEE"
fi

if [[ -n "$LND_FEE_RATE" ]]; then
    echo "Setting custom fee rate for bitcoin: $LND_FEE_RATE"
    PARAMS="$PARAMS --bitcoin.feerate=$LND_FEE_RATE"
fi

exec lnd $PARAMS "$@"
