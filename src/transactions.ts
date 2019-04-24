
import * as StellarSdk from 'stellar-sdk';

export function destroyToken(
    account: StellarSdk.Account,
    asset: StellarSdk.Asset,
    fee: number = 100
): StellarSdk.Transaction {

    const source = account.accountId();
    return new StellarSdk.TransactionBuilder(account, {fee: fee})
    .addOperation(StellarSdk.Operation.accountMerge({
        source: asset,
        destination: source
    }))
    .setTimeout(0)
    .build();
}

export function transferToken(
    account: StellarSdk.Account,
    dest: string,
    asset: StellarSdk.Asset,
    fee: number = 100
): StellarSdk.Transaction {

    const source = account.accountId();
    return new StellarSdk.TransactionBuilder(account, {fee: fee})
    .addOperation(StellarSdk.Operation.setOptions({
        source: asset,
        signer: {
            ed25519PublicKey: dest,
            weight: 1
        }
    }))
    .addOperation(StellarSdk.Operation.setOptions({
        source: asset,
        signer: {
            ed25519PublicKey: source,
            weight: 0
        }
    }))
    .setTimeout(0)
    .build();
}

export function swapToken(
    account: StellarSdk.Account,
    dest: string,
    token: string,
    asset: StellarSdk.Asset,
    amount: string,
    fee: number = 100
): StellarSdk.Transaction {

    const source = account.accountId();
    return new StellarSdk.TransactionBuilder(account, {fee: fee})
    .addOperation(StellarSdk.Operation.payment({
        source: dest,
        destination: source,
        asset: asset,
        amount: amount
    }))
    .addOperation(StellarSdk.Operation.setOptions({
        source: token,
        signer: {
            ed25519PublicKey: dest,
            weight: 1
        }
    }))
    .addOperation(StellarSdk.Operation.setOptions({
        source: token,
        signer: {
            ed25519PublicKey: source,
            weight: 0
        }
    }))
    .setTimeout(0)
    .build();
}
