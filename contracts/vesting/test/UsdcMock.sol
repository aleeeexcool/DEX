pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UsdcMock is ERC20 {
    constructor() ERC20("USDC Mock", "USDC") {
        _mint(msg.sender, 1000000000 * 10**18); //one billion
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
