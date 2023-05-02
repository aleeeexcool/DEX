// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "../libraries/token/IERC20.sol";

import "../core/interfaces/IWlpManager.sol";

import "./interfaces/IRewardTracker.sol";
import "./interfaces/IRewardTracker.sol";

// provide a way to transfer staked WLP tokens by unstaking from the sender
// and staking for the receiver
// tests in RewardRouterV2.js
contract StakedWlp {
    using SafeMath for uint256;

    string public constant name = "StakedWlp";
    string public constant symbol = "sWLP";
    uint8 public constant decimals = 18;

    address public wlp;
    IWlpManager public wlpManager;
    address public stakedWlpTracker;
    address public feeWlpTracker;

    mapping (address => mapping (address => uint256)) public allowances;

    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        address _wlp,
        IWlpManager _wlpManager,
        address _stakedWlpTracker,
        address _feeWlpTracker
    ) public {
        wlp = _wlp;
        wlpManager = _wlpManager;
        stakedWlpTracker = _stakedWlpTracker;
        feeWlpTracker = _feeWlpTracker;
    }

    function allowance(address _owner, address _spender) external view returns (uint256) {
        return allowances[_owner][_spender];
    }

    function approve(address _spender, uint256 _amount) external returns (bool) {
        _approve(msg.sender, _spender, _amount);
        return true;
    }

    function transfer(address _recipient, uint256 _amount) external returns (bool) {
        _transfer(msg.sender, _recipient, _amount);
        return true;
    }

    function transferFrom(address _sender, address _recipient, uint256 _amount) external returns (bool) {
        uint256 nextAllowance = allowances[_sender][msg.sender].sub(_amount, "StakedWlp: transfer amount exceeds allowance");
        _approve(_sender, msg.sender, nextAllowance);
        _transfer(_sender, _recipient, _amount);
        return true;
    }

    function balanceOf(address _account) external view returns (uint256) {
        return IRewardTracker(feeWlpTracker).depositBalances(_account, wlp);
    }

    function totalSupply() external view returns (uint256) {
        return IERC20(stakedWlpTracker).totalSupply();
    }

    function _approve(address _owner, address _spender, uint256 _amount) private {
        require(_owner != address(0), "StakedWlp: approve from the zero address");
        require(_spender != address(0), "StakedWlp: approve to the zero address");

        allowances[_owner][_spender] = _amount;

        emit Approval(_owner, _spender, _amount);
    }

    function _transfer(address _sender, address _recipient, uint256 _amount) private {
        require(_sender != address(0), "StakedWlp: transfer from the zero address");
        require(_recipient != address(0), "StakedWlp: transfer to the zero address");

        require(
            wlpManager.lastAddedAt(_sender).add(wlpManager.cooldownDuration()) <= block.timestamp,
            "StakedWlp: cooldown duration not yet passed"
        );

        IRewardTracker(stakedWlpTracker).unstakeForAccount(_sender, feeWlpTracker, _amount, _sender);
        IRewardTracker(feeWlpTracker).unstakeForAccount(_sender, wlp, _amount, _sender);

        IRewardTracker(feeWlpTracker).stakeForAccount(_sender, _recipient, wlp, _amount);
        IRewardTracker(stakedWlpTracker).stakeForAccount(_recipient, _recipient, feeWlpTracker, _amount);
    }
}
