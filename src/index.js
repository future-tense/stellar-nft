
import axios from 'axios';
import StellarSDK from 'stellar-sdk';
import sign from './sign';

export const networks = {
    public:  StellarSDK.Networks.PUBLIC,
    testnet: StellarSDK.Networks.TESTNET
};

export class NFT {

    constructor({
        horizon = 'https://horizon.stellar.org',
        network = networks.public,
    } = {}) {
        this.horizon = new StellarSDK.Server(horizon);
        this.networkId = StellarSDK.hash(network);
    }

    token(id) {
        return new Token(id, this);
    }
}

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

class Token {

    /**
     *
     * @param id
     * @param config
     */
    constructor(id, config) {
        this.id = id;
        this.horizon = config.horizon;
        this.networkId = config.networkId;
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
        const account = await this.horizon.accounts().accountId(this.id).call();
        const item = account.signers.filter(item => item.weight === 1)[0];
        return item.key;
    }

    /**
     *
     * @returns {Promise<any>}
     */
    async getMetadata() {

        //  retrieve hash for an account using reverse federation

        const account = await this.horizon.accounts().accountId(this.id).call();
        const federationServer = await StellarSDK.FederationServer.createForDomain(account.homeDomain);

        const federationRecord = await federationServer.resolveAccountId(this.id);
        const address = federationRecord.stellar_address;
        const hash = address.split('*')[0];

        //  retrieve metadata object

        const url = `https://ipfs.io/ipfs/${hash}/`;
        const {data} = await axios.get(url);

        //  verify that data.id === this.id
        return data.meta;
    }

    /**
     *
     * @param ownerKeys
     * @returns {Promise<*|{value}>}
     */
    async destroy(ownerKeys) {
        const source = ownerKeys.publicKey();

        const account = await this.horizon.loadAccount(source);
        const tx = TokenTransactionBuilder.destroyToken(account, source, this.id);

        sign(tx, ownerKeys, this.networkId);

        return this.horizon.submitTransaction(tx);
    }

    /**
     *
     * @param ownerKeys
     * @param dest
     * @returns {Promise<*|{value}>}
     */
    async transfer(ownerKeys, dest) {
        const source = ownerKeys.publicKey();

        const account = await this.horizon.loadAccount(source);
        const tx = TokenTransactionBuilder.transferToken(account, source, dest, this.id);

        sign(tx, ownerKeys, this.networkId);

        return this.horizon.submitTransaction(tx);
    }
}
