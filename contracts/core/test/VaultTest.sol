// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../Vault.sol";

contract VaultTest is Vault {
    constructor(address delegatePartOne, address delegatePartTwo,  address delegatePartThree) Vault(delegatePartOne, delegatePartTwo, delegatePartThree) public {

    }
    function increaseGlobalShortSize(address token, uint256 amount) external {
        _increaseGlobalShortSize(token, amount);
    }
}
