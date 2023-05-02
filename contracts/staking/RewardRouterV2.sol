// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../libraries/math/SafeMath.sol";
import "../libraries/token/IERC20.sol";
import "../libraries/token/SafeERC20.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../libraries/utils/Address.sol";

import "./interfaces/IRewardTracker.sol";
import "./interfaces/IRewardRouterV2.sol";
import "./interfaces/IVester.sol";
import "../tokens/interfaces/IMintable.sol";
import "../tokens/interfaces/IWETH.sol";
import "../core/interfaces/IWlpManager.sol";
import "../access/Governable.sol";

contract RewardRouterV2 is IRewardRouterV2, ReentrancyGuard, Governable {
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

    address public override stakedWlpTracker;
    address public override feeWlpTracker;

    address public wlpManager;

    address public wxtVester;
    address public wlpVester;

    mapping (address => address) public pendingReceivers;

    event StakeWxt(address account, address token, uint256 amount);
    event UnstakeWxt(address account, address token, uint256 amount);

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
        address _wlpManager,
        address _wxtVester,
        address _wlpVester
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

        wxtVester = _wxtVester;
        wlpVester = _wlpVester;
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
        _unstakeWxt(msg.sender, wxt, _amount, true);
    }

    function unstakeEsWxt(uint256 _amount) external nonReentrant {
        _unstakeWxt(msg.sender, esWxt, _amount, true);
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

    function handleRewards(
        bool _shouldClaimWxt,
        bool _shouldStakeWxt,
        bool _shouldClaimEsWxt,
        bool _shouldStakeEsWxt,
        bool _shouldStakeMultiplierPoints,
        bool _shouldClaimWeth,
        bool _shouldConvertWethToEth
    ) external nonReentrant {
        address account = msg.sender;

        uint256 wxtAmount = 0;
        if (_shouldClaimWxt) {
            uint256 wxtAmount0 = IVester(wxtVester).claimForAccount(account, account);
            uint256 wxtAmount1 = IVester(wlpVester).claimForAccount(account, account);
            wxtAmount = wxtAmount0.add(wxtAmount1);
        }

        if (_shouldStakeWxt && wxtAmount > 0) {
            _stakeWxt(account, account, wxt, wxtAmount);
        }

        uint256 esWxtAmount = 0;
        if (_shouldClaimEsWxt) {
            uint256 esWxtAmount0 = IRewardTracker(stakedWxtTracker).claimForAccount(account, account);
            uint256 esWxtAmount1 = IRewardTracker(stakedWlpTracker).claimForAccount(account, account);
            esWxtAmount = esWxtAmount0.add(esWxtAmount1);
        }

        if (_shouldStakeEsWxt && esWxtAmount > 0) {
            _stakeWxt(account, account, esWxt, esWxtAmount);
        }

        if (_shouldStakeMultiplierPoints) {
            uint256 bnWxtAmount = IRewardTracker(bonusWxtTracker).claimForAccount(account, account);
            if (bnWxtAmount > 0) {
                IRewardTracker(feeWxtTracker).stakeForAccount(account, account, bnWxt, bnWxtAmount);
            }
        }

        if (_shouldClaimWeth) {
            if (_shouldConvertWethToEth) {
                uint256 weth0 = IRewardTracker(feeWxtTracker).claimForAccount(account, address(this));
                uint256 weth1 = IRewardTracker(feeWlpTracker).claimForAccount(account, address(this));

                uint256 wethAmount = weth0.add(weth1);
                IWETH(weth).withdraw(wethAmount);

                payable(account).sendValue(wethAmount);
            } else {
                IRewardTracker(feeWxtTracker).claimForAccount(account, account);
                IRewardTracker(feeWlpTracker).claimForAccount(account, account);
            }
        }
    }

    function batchCompoundForAccounts(address[] memory _accounts) external nonReentrant onlyGov {
        for (uint256 i = 0; i < _accounts.length; i++) {
            _compound(_accounts[i]);
        }
    }

    // the _validateReceiver function checks that the averageStakedAmounts and cumulativeRewards
    // values of an account are zero, this is to help ensure that vesting calculations can be
    // done correctly
    // averageStakedAmounts and cumulativeRewards are updated if the claimable reward for an account
    // is more than zero
    // it is possible for multiple transfers to be sent into a single account, using signalTransfer and
    // acceptTransfer, if those values have not been updated yet
    // for WLP transfers it is also possible to transfer WLP into an account using the StakedWlp contract
    function signalTransfer(address _receiver) external nonReentrant {
        require(IERC20(wxtVester).balanceOf(msg.sender) == 0, "RewardRouter: sender has vested tokens");
        require(IERC20(wlpVester).balanceOf(msg.sender) == 0, "RewardRouter: sender has vested tokens");

        _validateReceiver(_receiver);
        pendingReceivers[msg.sender] = _receiver;
    }

    function acceptTransfer(address _sender) external nonReentrant {
        require(IERC20(wxtVester).balanceOf(_sender) == 0, "RewardRouter: sender has vested tokens");
        require(IERC20(wlpVester).balanceOf(_sender) == 0, "RewardRouter: sender has vested tokens");

        address receiver = msg.sender;
        require(pendingReceivers[_sender] == receiver, "RewardRouter: transfer not signalled");
        delete pendingReceivers[_sender];

        _validateReceiver(receiver);
        _compound(_sender);

        uint256 stakedWxt = IRewardTracker(stakedWxtTracker).depositBalances(_sender, wxt);
        if (stakedWxt > 0) {
            _unstakeWxt(_sender, wxt, stakedWxt, false);
            _stakeWxt(_sender, receiver, wxt, stakedWxt);
        }

        uint256 stakedEsWxt = IRewardTracker(stakedWxtTracker).depositBalances(_sender, esWxt);
        if (stakedEsWxt > 0) {
            _unstakeWxt(_sender, esWxt, stakedEsWxt, false);
            _stakeWxt(_sender, receiver, esWxt, stakedEsWxt);
        }

        uint256 stakedBnWxt = IRewardTracker(feeWxtTracker).depositBalances(_sender, bnWxt);
        if (stakedBnWxt > 0) {
            IRewardTracker(feeWxtTracker).unstakeForAccount(_sender, bnWxt, stakedBnWxt, _sender);
            IRewardTracker(feeWxtTracker).stakeForAccount(_sender, receiver, bnWxt, stakedBnWxt);
        }

        uint256 esWxtBalance = IERC20(esWxt).balanceOf(_sender);
        if (esWxtBalance > 0) {
            IERC20(esWxt).transferFrom(_sender, receiver, esWxtBalance);
        }

        uint256 wlpAmount = IRewardTracker(feeWlpTracker).depositBalances(_sender, wlp);
        if (wlpAmount > 0) {
            IRewardTracker(stakedWlpTracker).unstakeForAccount(_sender, feeWlpTracker, wlpAmount, _sender);
            IRewardTracker(feeWlpTracker).unstakeForAccount(_sender, wlp, wlpAmount, _sender);

            IRewardTracker(feeWlpTracker).stakeForAccount(_sender, receiver, wlp, wlpAmount);
            IRewardTracker(stakedWlpTracker).stakeForAccount(receiver, receiver, feeWlpTracker, wlpAmount);
        }

        IVester(wxtVester).transferStakeValues(_sender, receiver);
        IVester(wlpVester).transferStakeValues(_sender, receiver);
    }

    function _validateReceiver(address _receiver) private view {
        require(IRewardTracker(stakedWxtTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: stakedWxtTracker.averageStakedAmounts > 0");
        require(IRewardTracker(stakedWxtTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: stakedWxtTracker.cumulativeRewards > 0");

        require(IRewardTracker(bonusWxtTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: bonusWxtTracker.averageStakedAmounts > 0");
        require(IRewardTracker(bonusWxtTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: bonusWxtTracker.cumulativeRewards > 0");

        require(IRewardTracker(feeWxtTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: feeWxtTracker.averageStakedAmounts > 0");
        require(IRewardTracker(feeWxtTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: feeWxtTracker.cumulativeRewards > 0");

        require(IVester(wxtVester).transferredAverageStakedAmounts(_receiver) == 0, "RewardRouter: wxtVester.transferredAverageStakedAmounts > 0");
        require(IVester(wxtVester).transferredCumulativeRewards(_receiver) == 0, "RewardRouter: wxtVester.transferredCumulativeRewards > 0");

        require(IRewardTracker(stakedWlpTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: stakedWlpTracker.averageStakedAmounts > 0");
        require(IRewardTracker(stakedWlpTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: stakedWlpTracker.cumulativeRewards > 0");

        require(IRewardTracker(feeWlpTracker).averageStakedAmounts(_receiver) == 0, "RewardRouter: feeWlpTracker.averageStakedAmounts > 0");
        require(IRewardTracker(feeWlpTracker).cumulativeRewards(_receiver) == 0, "RewardRouter: feeWlpTracker.cumulativeRewards > 0");

        require(IVester(wlpVester).transferredAverageStakedAmounts(_receiver) == 0, "RewardRouter: wxtVester.transferredAverageStakedAmounts > 0");
        require(IVester(wlpVester).transferredCumulativeRewards(_receiver) == 0, "RewardRouter: wxtVester.transferredCumulativeRewards > 0");

        require(IERC20(wxtVester).balanceOf(_receiver) == 0, "RewardRouter: wxtVester.balance > 0");
        require(IERC20(wlpVester).balanceOf(_receiver) == 0, "RewardRouter: wlpVester.balance > 0");
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

        emit StakeWxt(_account, _token, _amount);
    }

    function _unstakeWxt(address _account, address _token, uint256 _amount, bool _shouldReduceBnWxt) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        uint256 balance = IRewardTracker(stakedWxtTracker).stakedAmounts(_account);

        IRewardTracker(feeWxtTracker).unstakeForAccount(_account, bonusWxtTracker, _amount, _account);
        IRewardTracker(bonusWxtTracker).unstakeForAccount(_account, stakedWxtTracker, _amount, _account);
        IRewardTracker(stakedWxtTracker).unstakeForAccount(_account, _token, _amount, _account);

        if (_shouldReduceBnWxt) {
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
        }

        emit UnstakeWxt(_account, _token, _amount);
    }
}
