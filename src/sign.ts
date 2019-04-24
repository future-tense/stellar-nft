
import StellarSdk from 'stellar-sdk';

const envelopeType = StellarSdk.xdr.EnvelopeType.envelopeTypeTx().toXDR();

const transactionHash = (tx, networkId) =>
    StellarSdk.hash(
        Buffer.concat([
            networkId,
            envelopeType,
            tx.tx.toXDR()
        ])
    );

export function sign(
    tx: StellarSdk.Transaction,
    keypair: StellarSdk.Keypair,
    networkId: Buffer
): void {
    const hash = transactionHash(tx, networkId);
    const sig = keypair.signDecorated(hash);
    tx.signatures.push(sig);
}
