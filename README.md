# FireFly Tokens Microservice for ERC1155

This project provides a thin shim between [FireFly](https://github.com/hyperledger/firefly)
and an ERC1155 contract exposed via [ethconnect](https://github.com/hyperledger/firefly-ethconnect)
or [evmconnect](https://github.com/hyperledger/firefly-evmconnect).

Based on [Node.js](http://nodejs.org) and [Nest](http://nestjs.com).

This service is entirely stateless - it maps incoming REST operations directly to blockchain
calls, and maps blockchain events to outgoing websocket events.

## Smart Contracts

This connector is designed to interact with ERC1155 smart contracts on an Ethereum
blockchain which conform to a few different patterns. The repository includes sample
[Solidity contracts](samples/solidity/) that conform to some of the ABIs expected.

At the very minimum, _all_ contracts must implement the events and methods defined in the
ERC1155 standard, including the optional `uri()` method.

Beyond this, there are a few methods for creating a contract that the connector can utilize.

### FireFly Interface Parsing

The most flexible and robust token functionality is achieved by teaching FireFly about your token
contract, then allowing it to teach the token connector. This is optional in the sense that there
are additional methods used by the token connector to guess at the contract ABI (detailed later),
but is the preferred method for most use cases.

To leverage this capability in a running FireFly environment, you must:

1. [Upload the token contract ABI to FireFly](https://hyperledger.github.io/firefly/tutorials/custom_contracts/ethereum.html)
   as a contract interface.
2. Include the `interface` parameter when [creating the pool on FireFly](https://hyperledger.github.io/firefly/tutorials/tokens).

This will cause FireFly to parse the interface and provide ABI details
to this connector, so it can determine the best methods from the ABI to be used for each operation.
When this procedure is followed, the connector can find and call any variant of mint/burn/transfer/approval
that is listed in the source code for [erc1155.ts](src/tokens/erc1155.ts).
This list includes methods in the base standards, methods in the [IERC1155MixedFungible](samples/solidity/contracts/IERC1155MixedFungible.sol)
interface defined in this repository, and common method variants from the
[OpenZeppelin Wizard](https://wizard.openzeppelin.com). Additional variants can be added to the list
by building a custom version of this connector or by proposing them via pull request.

### Fallback Functionality (not recommended)

In the absence of being provided with ABI details, the token connector will assume that the contract
conforms to the `IERC1155MixedFungible` interface defined in this repository.

## API Extensions

The APIs of this connector conform to the FireFly fftokens standard, and are designed to be called by
FireFly. They should generally not be called directly by anything other than FireFly.

Below are some of the specific considerations and extra requirements enforced by this connector on
top of the fftokens standard.

### `/createpool`

If `config.address`, `config.startId`, and `config.endId` are all specified, the connector will assume
that a token pool has already been created on the specified contract, using the specified subset of
token IDs (inclusive). Note: Because ERC1155 defines the token ID as uint256, the range of possible IDs
is `0x0` to `0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`.

If `config.address` is specified, the connector will invoke the `create()` method (as defined in the
`IERC1155MixedFungible` interface) of the ERC1155 token contract at the specified address.

If `config.address` is not specified, and `CONTRACT_ADDRESS` is set in the connector's
environment, the `create()` method of that contract will be invoked.

Any `name` and `symbol` provided from FireFly are ignored by this connector.

### `/mint`

For fungible token pools, `tokenIndex` and `uri` will be ignored.

For non-fungible token pools, `tokenIndex` and `amount` will be handled differently depending on the
underlying ABI. The sample contract in this repository uses auto-indexing, so `tokenIndex` must be
omitted and `amount` may be 1 or greater (to mint 1 or more unique NFTs). The samples generated by
OpenZeppelin generally use manual indexing, so `tokenIndex` must be specified (as an offset from
the pool's `startId`) and `amount` must be 1.

### `/burn`

For non-fungible token pools, `tokenIndex` is required, and `amount` must be 1.

### `/transfer`

For non-fungible token pools, `tokenIndex` is required, and `amount` must be 1.

### `/approval`

All approvals are global and will apply to all tokens across _all_ pools on a particular ERC1155 contract.

## Extra APIs

The following APIs are not part of the fftokens standard, but are exposed under `/api/v1`:

- `GET /balance` - Get token balance
- `GET /receipt/:id` - Get receipt for a previous request

## Running the service

The easiest way to run this service is as part of a stack created via
[firefly-cli](https://github.com/hyperledger/firefly-cli).

To run manually, you first need to run an Ethereum blockchain node and an instance of
[firefly-ethconnect](https://github.com/hyperledger/firefly-ethconnect), and deploy the
[ERC1155 smart contract](solidity/contracts/ERC1155MixedFungible.sol).

Then, adjust your configuration to point at the deployed contract by editing [.env](.env)
or by setting the environment values directly in your shell.

Install and run the application using npm:

```bash
# install
$ npm install

# run in development mode
$ npm run start

# run in watch mode
$ npm run start:dev

# run in production mode
$ npm run start:prod
```

View the Swagger UI at http://localhost:3000/api<br />
View the generated OpenAPI spec at http://localhost:3000/api-json

## Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# lint
$ npm run lint

# formatting
$ npm run format
```

## Blockchain retry behaviour

Most short-term outages should be handled by the blockchain connector. For example if the blockchain node returns `HTTP 429` due to rate limiting
it is the blockchain connector's responsibility to use appropriate back-off retries to attempt to make the required blockchain call successfully.

There are cases where the token connector may need to perform its own back-off retry for a blockchain action. For example if the blockchain connector
microservice has crashed and is in the process of restarting just as the token connector is trying to query an NFT token URI to enrich a token event, if
the token connector doesn't perform a retry then the event will be returned without the token URI populated.

The token connector has configurable retry behaviour for all blockchain related calls. By default the connector will perform up to 15 retries with a back-off
interval between each one. The default first retry interval is 100ms and doubles up to a maximum of 10s per retry interval. Retries are only performed where
the error returned from the REST call matches a configurable regular expression retry condition. The default retry condition is `.*ECONN.*` which ensures
retries take place for common TCP errors such as `ECONNRESET` and `ECONNREFUSED`.

The configurable retry settings are:

- `RETRY_BACKOFF_FACTOR` (default `2`)
- `RETRY_BACKOFF_LIMIT_MS` (default `10000`)
- `RETRY_BACKOFF_INITIAL_MS` (default `100`)
- `RETRY_CONDITION` (default `.*ECONN.*`)
- `RETRY_MAX_ATTEMPTS` (default `15`)

Setting `RETRY_CONDITION` to `""` disables retries. Setting `RETRY_MAX_ATTEMPTS` to `-1` causes it to retry indefinitely.

Note, the token connector will make a total of `RETRY_MAX_ATTEMPTS` + 1 calls for a given retryable call (1 original attempt and `RETRY_MAX_ATTEMPTS` retries)

## TLS

Mutual TLS can be enabled by providing three environment variables:

- `TLS_CA`
- `TLS_CERT`
- `TLS_KEY`

Each should be a path to a file on disk. Providing all three environment variables will result in a token connector running with TLS enabled, and requiring all clients to provide client certificates signed by the certificate authority.
