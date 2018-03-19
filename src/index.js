
import axios from 'axios';
import StellarSDK from 'stellar-sdk';

const horizon = new StellarSDK.Server('https://horizon.stellar.org');
StellarSDK.Network.usePublicNetwork();

class TokenTransactionBuilder {

    static destroyToken(account, source, asset) {
        return new StellarSDK.TransactionBuilder(account)
        .addOperation(StellarSDK.Operation.accountMerge({
            source: asset,
            destination: source
        }))
        .build();
    }

    static transferToken(account, source, dest, asset) {
        return new StellarSDK.TransactionBuilder(account)
        .addOperation(StellarSDK.Operation.setOptions({
            source: asset,
            signer: {
                ed25519PublicKey: dest,
                weight: 1
            }
        }))
        .addOperation(StellarSDK.Operation.setOptions({
            source: asset,
            signer: {
                ed25519PublicKey: source,
                weight: 0
            }
        }))
        .build();
    }
}

export class Token {

    /**
     *
     * @param id
     */
    constructor(id) {
        this.id = id;
    }

    /**
     *
     * @returns {Token.id}
     */
    id() {
        return this.id;
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async getOwner() {
        const account = await horizon.accounts().accountId(this.id).call();
        const item = account.signers.filter(item => item.weight === 1)[0];
        return item.key;
    }

    /**
     *
     * @returns {Promise<any>}
     */
    async getMetadata() {

        //  retrieve hash for an account using reverse federation

        const account = await horizon.accounts().accountId(this.id).call();
        const federationServer = await StellarSDK.FederationServer.createForDomain(account.homeDomain);

        const federationRecord = await federationServer.resolveAccountId(this.id);
        const address = federationRecord.stellar_address;
        const hash = address.split('*')[0];

        //  retrieve metadata object

        const url = `https://ipfs.io/ipfs/${hash}/`;
        const result = await axios.get(url);

        //  verify that metadata.account === this.id
        return result.data;
    }

    /**
     *
     * @param ownerKeys
     * @returns {Promise<*|{value}>}
     */
    async destroy(ownerKeys) {
        const source = ownerKeys.publicKey();

        const account = await horizon.loadAccount(source);
        const tx = TokenTransactionBuilder.destroyToken(account, source, this.id);

        tx.sign(ownerKeys);

        return horizon.submitTransaction(tx);
    }

    /**
     *
     * @param ownerKeys
     * @param dest
     * @returns {Promise<*|{value}>}
     */
    async transfer(ownerKeys, dest) {
        const source = ownerKeys.publicKey();

        const account = await horizon.loadAccount(source);
        const tx = TokenTransactionBuilder.transferToken(account, source, dest, this.id);

        tx.sign(ownerKeys);

        return horizon.submitTransaction(tx);
    }
}
