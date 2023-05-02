// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../tokens/MintableBaseToken.sol";

contract EsWXT is MintableBaseToken {
    constructor() public MintableBaseToken("Escrowed WXT", "esWXT", 0) {
    }

    function id() external pure returns (string memory _name) {
        return "esWXT";
    }
}
