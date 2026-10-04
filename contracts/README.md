# Approva Base Contracts

Foundry project for the on-chain authorization/execution boundary.

## Install

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

## Compile

```bash
forge build -vvv
```

## Test

```bash
forge test -vvv
forge test --gas-report
```

## ABI

After compilation:

```bash
forge inspect ApprovaAuthorization abi > abi/ApprovaAuthorization.json
forge inspect ApprovaForwarder abi > abi/ApprovaForwarder.json
```

## Generate TypeScript ABI

With Foundry output:

```bash
node scripts/export-abis.mjs
```

The generated ABI is consumed by the TypeScript Base adapter.

## Design

The contracts are not intended to hold user funds.

The authorization contract validates an Approva authorization proof against an allowed request and execution target. Actual execution should remain behind a separately reviewed execution/relayer boundary.
