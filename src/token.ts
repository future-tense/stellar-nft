import axios from 'axios';
import * as stringifySafe from 'json-stringify-safe';
import * as StellarSdk from 'stellar-sdk';
import * as bs58 from 'bs58';

import * as transactions from './transactions';
import { sign } from './sign';
import { NFT } from './nft';

type Keypair = StellarSdk.Keypair;

export type Config = {
    FEDERATION_SERVER?: string;
    SIGNING_KEY?: string;
}

type SignedObject = {
    sig: string,
    meta: {}
}

function isValidSignedObject(
    config: Config,
    data: SignedObject
): boolean {

    if (!config.SIGNING_KEY) {
        throw new Error('Missing SIGNING_KEY in stellar.toml');
    }

    const {sig, meta} = data;
    const json = stringifySafe(meta);
    const hash = StellarSdk.hash(json);
    const signature = Buffer.from(sig, 'base64');

    const issuerKeys = StellarSdk.Keypair.fromPublicKey(config.SIGNING_KEY);
    return issuerKeys.verify(hash, signature);
}

async function getSignedObject(
    config: Config,
    cid: string
): Promise<SignedObject> {

    const url = `https://ipfs.io/ipfs/${cid}/`;
    const {data} = await axios.get(url);

    if (!isValidSignedObject(config, data)) {
        throw new Error('Invalid signature');
    }

    return data;
}

//  CID v1 - raw binary - SHA2-256
const PREFIX = Buffer.from('01551220', 'hex');

function getCID(
    hash: Buffer
): string {
    return 'z' + bs58.encode(Buffer.concat([PREFIX, hash]));
}

function getAccountIdFromCID(
    cid: string
): string {

    if (cid[0] !== 'z') {
        throw 'Unsupported CID format';
   }

    const multiHash = bs58.decode(cid.slice(1));
    if (PREFIX.compare(multiHash, 0, 4) !== 0) {
        throw 'Unsupported CID format';
    }

    return getAccountIdFromHash(multiHash.slice(4));
}

function getAccountIdFromHash(
    hash: Buffer
): string {
    const keys = StellarSdk.Keypair.fromRawEd25519Seed(hash);
    return keys.publicKey();
}

export class Token {

    readonly id: string;
    readonly horizon: StellarSdk.Server;
    readonly networkId: Buffer;
    readonly nft: NFT;
    private data: SignedObject;

    /**
     *
     * @param id
     * @param nft
     * @param data
     */
    public constructor(id: string, nft: NFT, data?: SignedObject) {
        this.id = id;
        this.horizon = nft.horizon;
        this.networkId = nft.networkId;
        this.nft = nft;

        if (data) {
            this.data = data;
        }
    }

    public static async fromSignedObject(data: SignedObject, nft: NFT): Promise<Token> {

        const hash = StellarSdk.hash(data);
        const id = getAccountIdFromHash(hash);

        const config = await nft.getHomeDomainConfig(id);
        if (!isValidSignedObject(config, data)) {
            throw new Error('Invalid signature');
        }

        return new Token(id, nft, data);
    }

    /**
     *
     * @returns {Promise<void>}
     */
    public async getOwner(): Promise<string> {
        const {signers} = await this.nft.getAccountInfo(this.id);
        const item = signers.filter(item => item.weight === 1)[0];
        return item.key;
    }

    public async getSignedObject(): Promise<SignedObject> {
        if (!this.data) {
            const config = await this.getHomeDomainConfig();
            const cid = await this.getCid(config);
            this.data = await getSignedObject(config, cid);
        }
        return this.data;
    }

    /**
     *
     * @returns {Promise<{}>}
     */
    public async getMetadata(): Promise<{}> {
        const {meta} = await this.getSignedObject();
        return meta;
    }

    /**
     *
     * @param ownerKeys
     * @returns {Promise<*|{value}>}
     */
    public async destroy(ownerKeys: Keypair) {

        const source = ownerKeys.publicKey();
        const account = await this.horizon.loadAccount(source);
        const tx = transactions.destroyToken(account, this.id);

        sign(tx, ownerKeys, this.networkId);

        return this.horizon.submitTransaction(tx);
    }

    /**
     *
     * @param ownerKeys
     * @param dest
     * @returns {Promise<*|{value}>}
     */
    public async transfer(ownerKeys: Keypair, dest: string) {

        const source = ownerKeys.publicKey();
        const account = await this.horizon.loadAccount(source);
        const tx = transactions.transferToken(account, dest, this.id);

        sign(tx, ownerKeys, this.networkId);

        return this.horizon.submitTransaction(tx);
    }

    /**
     *
     * @returns {Promise<*>}
     */
    private async getHomeDomainConfig(): Promise<Config> {
        return this.nft.getHomeDomainConfig(this.id);
    }

    private async getCid(config: Config): Promise<string> {

        if (!config.FEDERATION_SERVER) {
            throw new Error('Missing FEDERATION_SERVER in stellar.toml');
        }

        const url = `${config.FEDERATION_SERVER}?type=id&q=${this.id}`;
        const {data} = await axios.get(url);
        const cid = data.stellar_address.split('*')[0];

        if (getAccountIdFromCID(cid) !== this.id) {
            throw new Error('CID doesn\'t correspond to account ID');
        }

        return cid;
    }
}
