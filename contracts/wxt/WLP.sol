// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../tokens/MintableBaseToken.sol";

contract WLP is MintableBaseToken {
    constructor() public MintableBaseToken("WXT LP", "WLP", 0) {
    }

    function id() external pure returns (string memory _name) {
        return "WLP";
    }
}
