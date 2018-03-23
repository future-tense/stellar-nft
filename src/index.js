
import axios from 'axios';
import StellarSdk from 'stellar-sdk';
import multihash from 'multihashes';
import toml from 'toml-j0.4';
import stringifySafe from 'json-stringify-safe';

import sign from './sign';

const isValidSignedObject = (config, so) => {

    if (!config.SIGNING_KEY) {
        throw new Error('Missing SIGNING_KEY in stellar.toml');
    }

    const {sig, meta} = so;
    const json = stringifySafe(meta);
    const hash = StellarSdk.hash(json);
    const signature = new Buffer(sig, 'base64');

    const issuerKeys = StellarSdk.Keypair.fromPublicKey(config.SIGNING_KEY);
    return issuerKeys.verify(hash, signature);
};

const getSignedObject = async (config, cid) => {
    const url = `https://ipfs.io/ipfs/${cid}/`;
    const {data} = await axios.get(url);

    if (!isValidSignedObject(config, data)) {
        throw new Error('Invalid signature');
    }

    return data.meta;
};

const getAccountId = cid => {
    const hash = multihash.fromB58String(cid);
    const rawHash = multihash.decode(hash).digest;
    const keys = StellarSdk.Keypair.fromRawEd25519Seed(rawHash);
    return keys.publicKey();
};

export const networks = {
    public:  StellarSdk.Networks.PUBLIC,
    testnet: StellarSdk.Networks.TESTNET
};

export class NFT {

    constructor({
        horizon = 'https://horizon.stellar.org',
        network = networks.public,
    } = {}) {
        this.horizon = new StellarSdk.Server(horizon);
        this.networkId = StellarSdk.hash(network);
    }

    token(id) {
        return new Token(id, this);
    }

    /**
     *
     * @param [params.homedomain]
     * @param [params.owner]
     * @returns {Promise<void>}
     */
    async listTokens(params) {
        const {data} = await axios.get('https://nft.futuretense.io/api/tokens', {params: params});
        return data.map(item => this.token(item.accountid));
    }
}

class TokenTransactionBuilder {

    static destroyToken(account, source, asset) {
        return new StellarSdk.TransactionBuilder(account)
        .addOperation(StellarSdk.Operation.accountMerge({
            source: asset,
            destination: source
        }))
        .build();
    }

    static transferToken(account, source, dest, asset) {
        return new StellarSdk.TransactionBuilder(account)
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
     * @returns {Promise<*>}
     */
    async getHomedomainConfig() {
        const {home_domain} = await this.horizon.accounts().accountId(this.id).call();
        const url = `https://${home_domain}/.well-known/stellar.toml`;
        const {data} = await axios.get(url);
        return toml.parse(data);
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async getOwner() {
        const {signers} = await this.horizon.accounts().accountId(this.id).call();
        const item = signers.filter(item => item.weight === 1)[0];
        return item.key;
    }

    async getCid(config) {

        if (!config.FEDERATION_SERVER) {
            throw new Error('Missing FEDERATION_SERVER in stellar.toml');
        }

        const url = `${config.FEDERATION_SERVER}?type=id&q=${this.id}`;
        const {data} = await axios.get(url);
        const cid = data.stellar_address.split('*')[0];

        if (getAccountId(cid) !== this.id) {
            throw new Error('CID doesn\'t correspond to account ID');
        }

        return cid;
    }

    /**
     *
     * @returns {Promise<any>}
     */
    async getMetadata() {
        const config = await this.getHomedomainConfig();
        const cid = await this.getCid(config);
        return getSignedObject(config, cid);
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
