import axios from 'axios';
import * as toml from 'toml-j0.4';
import * as StellarSdk from 'stellar-sdk';

import { Networks } from './index';
import {
    Config,
    Token
} from './token';

type Network = typeof Networks.TESTNET;

type AccountRecord = StellarSdk.Server.AccountRecord;

export class NFT {

    readonly horizon: StellarSdk.Server;
    readonly networkId: Buffer;

    public constructor({
        horizon = 'https://horizon.stellar.org',
        network = Networks.PUBLIC,
    }: {
        horizon?: string,
        network?: Network
    } = {}) {
        this.horizon = new StellarSdk.Server(horizon);
        this.networkId = StellarSdk.hash(network);
    }

    public token(id: string): Token {
        return new Token(id, this);
    }

    public async tokenFromSignedObject(data): Promise<Token> {
        return Token.fromSignedObject(data, this);
    }

    /**
     *
     * @param [params.homedomain]
     * @param [params.owner]
     * @returns {Promise<void>}
     */
/*
    public async listTokens(params): Promise<string[]> {
        const {data} = await axios.get('https://nft.futuretense.io/api/tokens', {params: params});
        return data.map(item => this.token(item.accountid));
    }
*/

    public async getHomeDomainConfig(id: string): Promise<Config> {
        const {home_domain} = await this.getAccountInfo(id);
        const url = `https://${home_domain}/.well-known/stellar.toml`;
        const {data} = await axios.get(url);
        return toml.parse(data);
    }

    public async getAccountInfo(id: string): Promise<AccountRecord> {
        return this.horizon.accounts().accountId(id).call();
    }
}
