// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../tokens/MintableBaseToken.sol";

contract ZKE is MintableBaseToken {
    address public immutable underlying;

    constructor() public MintableBaseToken("ZKE", "ZKE", 0) {
        underlying = address(0x0);
    }

    function id() external pure returns (string memory _name) {
        return "ZKE";
    }
}
