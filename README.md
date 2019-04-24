


# Example usage

```javascript
import {NFT, networks} from 'stellar-nft';

(async function () {

    const nft = new NFT({
        horizon: 'https://horizon-testnet.stellar.org',
        network: networks.testnet
    });

    const token = nft.token('GAB35A2WLFSK64P6EWSGVFXZYU6E5K2INGTTLMDEDSIPYOH7NZVV6GIG');
    const owner = await token.getOwner();
    console.log(owner);

    const metadata = await token.getMetadata();
    console.log(metadata);
})();
```

Copyright © 2018-2019 Future Tense, LLC
