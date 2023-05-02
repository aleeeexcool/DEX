// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "../libraries/token/IERC20.sol";
import "../libraries/token/SafeERC20.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../libraries/utils/Address.sol";

import "./interfaces/IRewardTracker.sol";
import "../tokens/interfaces/IMintable.sol";
import "../tokens/interfaces/IWETH.sol";
import "../core/interfaces/IWlpManager.sol";
import "../access/Governable.sol";

contract RewardRouter is ReentrancyGuard, Governable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address payable;

    bool public isInitialized;

    address public weth;

    address public wxt;
    address public esWxt;
    address public bnWxt;

    address public wlp; // WXT Liquidity Provider token

    address public stakedWxtTracker;
    address public bonusWxtTracker;
    address public feeWxtTracker;

    address public stakedWlpTracker;
    address public feeWlpTracker;

    address public wlpManager;

    event StakeWxt(address account, uint256 amount);
    event UnstakeWxt(address account, uint256 amount);

    event StakeWlp(address account, uint256 amount);
    event UnstakeWlp(address account, uint256 amount);

    receive() external payable {
        require(msg.sender == weth, "Router: invalid sender");
    }

    function initialize(
        address _weth,
        address _wxt,
        address _esWxt,
        address _bnWxt,
        address _wlp,
        address _stakedWxtTracker,
        address _bonusWxtTracker,
        address _feeWxtTracker,
        address _feeWlpTracker,
        address _stakedWlpTracker,
        address _wlpManager
    ) external onlyGov {
        require(!isInitialized, "RewardRouter: already initialized");
        isInitialized = true;

        weth = _weth;

        wxt = _wxt;
        esWxt = _esWxt;
        bnWxt = _bnWxt;

        wlp = _wlp;

        stakedWxtTracker = _stakedWxtTracker;
        bonusWxtTracker = _bonusWxtTracker;
        feeWxtTracker = _feeWxtTracker;

        feeWlpTracker = _feeWlpTracker;
        stakedWlpTracker = _stakedWlpTracker;

        wlpManager = _wlpManager;
    }

    // to help users who accidentally send their tokens to this contract
    function withdrawToken(address _token, address _account, uint256 _amount) external onlyGov {
        IERC20(_token).safeTransfer(_account, _amount);
    }

    function batchStakeWxtForAccount(address[] memory _accounts, uint256[] memory _amounts) external nonReentrant onlyGov {
        address _wxt = wxt;
        for (uint256 i = 0; i < _accounts.length; i++) {
            _stakeWxt(msg.sender, _accounts[i], _wxt, _amounts[i]);
        }
    }

    function stakeWxtForAccount(address _account, uint256 _amount) external nonReentrant onlyGov {
        _stakeWxt(msg.sender, _account, wxt, _amount);
    }

    function stakeWxt(uint256 _amount) external nonReentrant {
        _stakeWxt(msg.sender, msg.sender, wxt, _amount);
    }

    function stakeEsWxt(uint256 _amount) external nonReentrant {
        _stakeWxt(msg.sender, msg.sender, esWxt, _amount);
    }

    function unstakeWxt(uint256 _amount) external nonReentrant {
        _unstakeWxt(msg.sender, wxt, _amount);
    }

    function unstakeEsWxt(uint256 _amount) external nonReentrant {
        _unstakeWxt(msg.sender, esWxt, _amount);
    }

    function mintAndStakeWlp(address _token, uint256 _amount, uint256 _minUsdg, uint256 _minWlp) external nonReentrant returns (uint256) {
        require(_amount > 0, "RewardRouter: invalid _amount");

        address account = msg.sender;
        uint256 wlpAmount = IWlpManager(wlpManager).addLiquidityForAccount(account, account, _token, _amount, _minUsdg, _minWlp);
        IRewardTracker(feeWlpTracker).stakeForAccount(account, account, wlp, wlpAmount);
        IRewardTracker(stakedWlpTracker).stakeForAccount(account, account, feeWlpTracker, wlpAmount);

        emit StakeWlp(account, wlpAmount);

        return wlpAmount;
    }

    function mintAndStakeWlpETH(uint256 _minUsdg, uint256 _minWlp) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "RewardRouter: invalid msg.value");

        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).approve(wlpManager, msg.value);

        address account = msg.sender;
        uint256 wlpAmount = IWlpManager(wlpManager).addLiquidityForAccount(address(this), account, weth, msg.value, _minUsdg, _minWlp);

        IRewardTracker(feeWlpTracker).stakeForAccount(account, account, wlp, wlpAmount);
        IRewardTracker(stakedWlpTracker).stakeForAccount(account, account, feeWlpTracker, wlpAmount);

        emit StakeWlp(account, wlpAmount);

        return wlpAmount;
    }

    function unstakeAndRedeemWlp(address _tokenOut, uint256 _wlpAmount, uint256 _minOut, address _receiver) external nonReentrant returns (uint256) {
        require(_wlpAmount > 0, "RewardRouter: invalid _wlpAmount");

        address account = msg.sender;
        IRewardTracker(stakedWlpTracker).unstakeForAccount(account, feeWlpTracker, _wlpAmount, account);
        IRewardTracker(feeWlpTracker).unstakeForAccount(account, wlp, _wlpAmount, account);
        uint256 amountOut = IWlpManager(wlpManager).removeLiquidityForAccount(account, _tokenOut, _wlpAmount, _minOut, _receiver);

        emit UnstakeWlp(account, _wlpAmount);

        return amountOut;
    }

    function unstakeAndRedeemWlpETH(uint256 _wlpAmount, uint256 _minOut, address payable _receiver) external nonReentrant returns (uint256) {
        require(_wlpAmount > 0, "RewardRouter: invalid _wlpAmount");

        address account = msg.sender;
        IRewardTracker(stakedWlpTracker).unstakeForAccount(account, feeWlpTracker, _wlpAmount, account);
        IRewardTracker(feeWlpTracker).unstakeForAccount(account, wlp, _wlpAmount, account);
        uint256 amountOut = IWlpManager(wlpManager).removeLiquidityForAccount(account, weth, _wlpAmount, _minOut, address(this));

        IWETH(weth).withdraw(amountOut);

        _receiver.sendValue(amountOut);

        emit UnstakeWlp(account, _wlpAmount);

        return amountOut;
    }

    function claim() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeWxtTracker).claimForAccount(account, account);
        IRewardTracker(feeWlpTracker).claimForAccount(account, account);

        IRewardTracker(stakedWxtTracker).claimForAccount(account, account);
        IRewardTracker(stakedWlpTracker).claimForAccount(account, account);
    }

    function claimEsWxt() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(stakedWxtTracker).claimForAccount(account, account);
        IRewardTracker(stakedWlpTracker).claimForAccount(account, account);
    }

    function claimFees() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeWxtTracker).claimForAccount(account, account);
        IRewardTracker(feeWlpTracker).claimForAccount(account, account);
    }

    function compound() external nonReentrant {
        _compound(msg.sender);
    }

    function compoundForAccount(address _account) external nonReentrant onlyGov {
        _compound(_account);
    }

    function batchCompoundForAccounts(address[] memory _accounts) external nonReentrant onlyGov {
        for (uint256 i = 0; i < _accounts.length; i++) {
            _compound(_accounts[i]);
        }
    }

    function _compound(address _account) private {
        _compoundWxt(_account);
        _compoundWlp(_account);
    }

    function _compoundWxt(address _account) private {
        uint256 esWxtAmount = IRewardTracker(stakedWxtTracker).claimForAccount(_account, _account);
        if (esWxtAmount > 0) {
            _stakeWxt(_account, _account, esWxt, esWxtAmount);
        }

        uint256 bnWxtAmount = IRewardTracker(bonusWxtTracker).claimForAccount(_account, _account);
        if (bnWxtAmount > 0) {
            IRewardTracker(feeWxtTracker).stakeForAccount(_account, _account, bnWxt, bnWxtAmount);
        }
    }

    function _compoundWlp(address _account) private {
        uint256 esWxtAmount = IRewardTracker(stakedWlpTracker).claimForAccount(_account, _account);
        if (esWxtAmount > 0) {
            _stakeWxt(_account, _account, esWxt, esWxtAmount);
        }
    }

    function _stakeWxt(address _fundingAccount, address _account, address _token, uint256 _amount) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        IRewardTracker(stakedWxtTracker).stakeForAccount(_fundingAccount, _account, _token, _amount);
        IRewardTracker(bonusWxtTracker).stakeForAccount(_account, _account, stakedWxtTracker, _amount);
        IRewardTracker(feeWxtTracker).stakeForAccount(_account, _account, bonusWxtTracker, _amount);

        emit StakeWxt(_account, _amount);
    }

    function _unstakeWxt(address _account, address _token, uint256 _amount) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        uint256 balance = IRewardTracker(stakedWxtTracker).stakedAmounts(_account);

        IRewardTracker(feeWxtTracker).unstakeForAccount(_account, bonusWxtTracker, _amount, _account);
        IRewardTracker(bonusWxtTracker).unstakeForAccount(_account, stakedWxtTracker, _amount, _account);
        IRewardTracker(stakedWxtTracker).unstakeForAccount(_account, _token, _amount, _account);

        uint256 bnWxtAmount = IRewardTracker(bonusWxtTracker).claimForAccount(_account, _account);
        if (bnWxtAmount > 0) {
            IRewardTracker(feeWxtTracker).stakeForAccount(_account, _account, bnWxt, bnWxtAmount);
        }

        uint256 stakedBnWxt = IRewardTracker(feeWxtTracker).depositBalances(_account, bnWxt);
        if (stakedBnWxt > 0) {
            uint256 reductionAmount = stakedBnWxt.mul(_amount).div(balance);
            IRewardTracker(feeWxtTracker).unstakeForAccount(_account, bnWxt, reductionAmount, _account);
            IMintable(bnWxt).burn(_account, reductionAmount);
        }

        emit UnstakeWxt(_account, _amount);
    }
}
