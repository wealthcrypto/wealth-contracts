# WealthToken (WEALTH)

ERC20 token with a fixed maximum supply and an initial distribution to predefined wallets at deployment. The token has no public mint function; supply can only decrease via owner burn. The contract also provides ownership management (transfer and renounce ownership).

## Token Specification
- Name: `WealthToken`
- Symbol: `WEALTH`
- Decimals: `18`
- Maximum Supply: `1,800,000 WEALTH`
- Contract file: `contracts/Wealth.sol`

## Initial Distribution
Set at deployment and minted directly to recipient addresses:
- Private Sale: `10%`
- Presale: `20%`
- Listing: `20%`
- Marketing & Development: `10%`
- Operations: `5%`
- Team Allocation: `5%`
- Reserve: `30%`

Percentages sum to `100%` and `MAX_SUPPLY` must be divisible by `100` (`contracts/Wealth.sol:231–233`).

## Roles and Ownership
- Initial `OWNER` is the deployer (`contracts/Wealth.sol:234–235`).
- Only `OWNER` can call `burn(uint256)` (`contracts/Wealth.sol:256–259`).
- `transferOwnership(address newOwner)` moves the owner role to a new address and rejects the zero address (`contracts/Wealth.sol:261–264`).
- `renounceOwnership()` sets owner to `address(0)`, disabling owner-only actions (`contracts/Wealth.sol:266–268`).

## Core Functions (ERC20)
- `totalSupply()`
- `balanceOf(address)`
- `transfer(address to, uint256 amount)`
- `approve(address spender, uint256 amount)`
- `allowance(address owner, address spender)`
- `transferFrom(address from, address to, uint256 amount)`
- `burn(uint256 amount)` — owner only
- `transferOwnership(address newOwner)` — owner only
- `renounceOwnership()` — owner only

The contract uses standard ERC20 errors for validation (e.g., `ERC20InsufficientBalance`, `ERC20InsufficientAllowance`, `ERC20InvalidSender/Receiver`).

## Security Notes
- After `renounceOwnership`, there is no owner and owner-only actions can no longer be performed.
- `transferOwnership` rejects the zero address to prevent accidental loss of owner rights.
- There is no public `mint`; supply only decreases through owner `burn`.

## Gas (indicative from tests)
- `transfer` ~ `51.6k`
- `transferFrom` ~ `52.9k`
- `approve` ~ `46.4k`
- `burn` ~ `31.2k`
- `transferOwnership` ~ `27.1k`
- `renounceOwnership` ~ `21.7k`