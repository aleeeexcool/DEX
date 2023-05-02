// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "../libraries/token/IERC20.sol";

import "../core/interfaces/IWlpManager.sol";

import "./interfaces/IRewardTracker.sol";
import "./interfaces/IRewardTracker.sol";

import "../access/Governable.sol";

// provide a way to migrate staked WLP tokens by unstaking from the sender
// and staking for the receiver
// meant for a one-time use for a specified sender
// requires the contract to be added as a handler for stakedWlpTracker and feeWlpTracker
contract StakedWlpMigrator is Governable {
    using SafeMath for uint256;

    address public sender;
    address public wlp;
    address public stakedWlpTracker;
    address public feeWlpTracker;
    bool public isEnabled = true;

    constructor(
        address _sender,
        address _wlp,
        address _stakedWlpTracker,
        address _feeWlpTracker
    ) public {
        sender = _sender;
        wlp = _wlp;
        stakedWlpTracker = _stakedWlpTracker;
        feeWlpTracker = _feeWlpTracker;
    }

    function disable() external onlyGov {
        isEnabled = false;
    }

    function transfer(address _recipient, uint256 _amount) external onlyGov {
        _transfer(sender, _recipient, _amount);
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) private {
        require(isEnabled, "StakedWlpMigrator: not enabled");
        require(_sender != address(0), "StakedWlpMigrator: transfer from the zero address");
        require(_recipient != address(0), "StakedWlpMigrator: transfer to the zero address");

        IRewardTracker(stakedWlpTracker).unstakeForAccount(_sender, feeWlpTracker, _amount, _sender);
        IRewardTracker(feeWlpTracker).unstakeForAccount(_sender, wlp, _amount, _sender);

        IRewardTracker(feeWlpTracker).stakeForAccount(_sender, _recipient, wlp, _amount);
        IRewardTracker(stakedWlpTracker).stakeForAccount(_recipient, _recipient, feeWlpTracker, _amount);
    }
}
