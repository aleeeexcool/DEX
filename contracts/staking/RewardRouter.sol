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
import "../core/interfaces/IZlpManager.sol";
import "../access/Governable.sol";

contract RewardRouter is ReentrancyGuard, Governable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address payable;

    bool public isInitialized;

    address public weth;

    address public zke;
    address public esZke;
    address public bnZke;

    address public zlp; // ZKE Liquidity Provider token

    address public stakedZkeTracker;
    address public bonusZkeTracker;
    address public feeZkeTracker;

    address public stakedZlpTracker;
    address public feeZlpTracker;

    address public zlpManager;

    event StakeZke(address account, uint256 amount);
    event UnstakeZke(address account, uint256 amount);

    event StakeZlp(address account, uint256 amount);
    event UnstakeZlp(address account, uint256 amount);

    receive() external payable {
        require(msg.sender == weth, "Router: invalid sender");
    }

    function initialize(
        address _weth,
        address _zke,
        address _esZke,
        address _bnZke,
        address _zlp,
        address _stakedZkeTracker,
        address _bonusZkeTracker,
        address _feeZkeTracker,
        address _feeZlpTracker,
        address _stakedZlpTracker,
        address _zlpManager
    ) external onlyGov {
        require(!isInitialized, "RewardRouter: already initialized");
        isInitialized = true;

        weth = _weth;

        zke = _zke;
        esZke = _esZke;
        bnZke = _bnZke;

        zlp = _zlp;

        stakedZkeTracker = _stakedZkeTracker;
        bonusZkeTracker = _bonusZkeTracker;
        feeZkeTracker = _feeZkeTracker;

        feeZlpTracker = _feeZlpTracker;
        stakedZlpTracker = _stakedZlpTracker;

        zlpManager = _zlpManager;
    }

    // to help users who accidentally send their tokens to this contract
    function withdrawToken(address _token, address _account, uint256 _amount) external onlyGov {
        IERC20(_token).safeTransfer(_account, _amount);
    }

    function batchStakeZkeForAccount(address[] memory _accounts, uint256[] memory _amounts) external nonReentrant onlyGov {
        address _zke = zke;
        for (uint256 i = 0; i < _accounts.length; i++) {
            _stakeZke(msg.sender, _accounts[i], _zke, _amounts[i]);
        }
    }

    function stakeZkeForAccount(address _account, uint256 _amount) external nonReentrant onlyGov {
        _stakeZke(msg.sender, _account, zke, _amount);
    }

    function stakeZke(uint256 _amount) external nonReentrant {
        _stakeZke(msg.sender, msg.sender, zke, _amount);
    }

    function stakeEsZke(uint256 _amount) external nonReentrant {
        _stakeZke(msg.sender, msg.sender, esZke, _amount);
    }

    function unstakeZke(uint256 _amount) external nonReentrant {
        _unstakeZke(msg.sender, zke, _amount);
    }

    function unstakeEsZke(uint256 _amount) external nonReentrant {
        _unstakeZke(msg.sender, esZke, _amount);
    }

    function mintAndStakeZlp(address _token, uint256 _amount, uint256 _minUsdg, uint256 _minZlp) external nonReentrant returns (uint256) {
        require(_amount > 0, "RewardRouter: invalid _amount");

        address account = msg.sender;
        uint256 zlpAmount = IZlpManager(zlpManager).addLiquidityForAccount(account, account, _token, _amount, _minUsdg, _minZlp);
        IRewardTracker(feeZlpTracker).stakeForAccount(account, account, zlp, zlpAmount);
        IRewardTracker(stakedZlpTracker).stakeForAccount(account, account, feeZlpTracker, zlpAmount);

        emit StakeZlp(account, zlpAmount);

        return zlpAmount;
    }

    function mintAndStakeZlpETH(uint256 _minUsdg, uint256 _minZlp) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "RewardRouter: invalid msg.value");

        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).approve(zlpManager, msg.value);

        address account = msg.sender;
        uint256 zlpAmount = IZlpManager(zlpManager).addLiquidityForAccount(address(this), account, weth, msg.value, _minUsdg, _minZlp);

        IRewardTracker(feeZlpTracker).stakeForAccount(account, account, zlp, zlpAmount);
        IRewardTracker(stakedZlpTracker).stakeForAccount(account, account, feeZlpTracker, zlpAmount);

        emit StakeZlp(account, zlpAmount);

        return zlpAmount;
    }

    function unstakeAndRedeemZlp(address _tokenOut, uint256 _zlpAmount, uint256 _minOut, address _receiver) external nonReentrant returns (uint256) {
        require(_zlpAmount > 0, "RewardRouter: invalid _zlpAmount");

        address account = msg.sender;
        IRewardTracker(stakedZlpTracker).unstakeForAccount(account, feeZlpTracker, _zlpAmount, account);
        IRewardTracker(feeZlpTracker).unstakeForAccount(account, zlp, _zlpAmount, account);
        uint256 amountOut = IZlpManager(zlpManager).removeLiquidityForAccount(account, _tokenOut, _zlpAmount, _minOut, _receiver);

        emit UnstakeZlp(account, _zlpAmount);

        return amountOut;
    }

    function unstakeAndRedeemZlpETH(uint256 _zlpAmount, uint256 _minOut, address payable _receiver) external nonReentrant returns (uint256) {
        require(_zlpAmount > 0, "RewardRouter: invalid _zlpAmount");

        address account = msg.sender;
        IRewardTracker(stakedZlpTracker).unstakeForAccount(account, feeZlpTracker, _zlpAmount, account);
        IRewardTracker(feeZlpTracker).unstakeForAccount(account, zlp, _zlpAmount, account);
        uint256 amountOut = IZlpManager(zlpManager).removeLiquidityForAccount(account, weth, _zlpAmount, _minOut, address(this));

        IWETH(weth).withdraw(amountOut);

        _receiver.sendValue(amountOut);

        emit UnstakeZlp(account, _zlpAmount);

        return amountOut;
    }

    function claim() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeZkeTracker).claimForAccount(account, account);
        IRewardTracker(feeZlpTracker).claimForAccount(account, account);

        IRewardTracker(stakedZkeTracker).claimForAccount(account, account);
        IRewardTracker(stakedZlpTracker).claimForAccount(account, account);
    }

    function claimEsZke() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(stakedZkeTracker).claimForAccount(account, account);
        IRewardTracker(stakedZlpTracker).claimForAccount(account, account);
    }

    function claimFees() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(feeZkeTracker).claimForAccount(account, account);
        IRewardTracker(feeZlpTracker).claimForAccount(account, account);
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
        _compoundZke(_account);
        _compoundZlp(_account);
    }

    function _compoundZke(address _account) private {
        uint256 esZkeAmount = IRewardTracker(stakedZkeTracker).claimForAccount(_account, _account);
        if (esZkeAmount > 0) {
            _stakeZke(_account, _account, esZke, esZkeAmount);
        }

        uint256 bnZkeAmount = IRewardTracker(bonusZkeTracker).claimForAccount(_account, _account);
        if (bnZkeAmount > 0) {
            IRewardTracker(feeZkeTracker).stakeForAccount(_account, _account, bnZke, bnZkeAmount);
        }
    }

    function _compoundZlp(address _account) private {
        uint256 esZkeAmount = IRewardTracker(stakedZlpTracker).claimForAccount(_account, _account);
        if (esZkeAmount > 0) {
            _stakeZke(_account, _account, esZke, esZkeAmount);
        }
    }

    function _stakeZke(address _fundingAccount, address _account, address _token, uint256 _amount) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        IRewardTracker(stakedZkeTracker).stakeForAccount(_fundingAccount, _account, _token, _amount);
        IRewardTracker(bonusZkeTracker).stakeForAccount(_account, _account, stakedZkeTracker, _amount);
        IRewardTracker(feeZkeTracker).stakeForAccount(_account, _account, bonusZkeTracker, _amount);

        emit StakeZke(_account, _amount);
    }

    function _unstakeZke(address _account, address _token, uint256 _amount) private {
        require(_amount > 0, "RewardRouter: invalid _amount");

        uint256 balance = IRewardTracker(stakedZkeTracker).stakedAmounts(_account);

        IRewardTracker(feeZkeTracker).unstakeForAccount(_account, bonusZkeTracker, _amount, _account);
        IRewardTracker(bonusZkeTracker).unstakeForAccount(_account, stakedZkeTracker, _amount, _account);
        IRewardTracker(stakedZkeTracker).unstakeForAccount(_account, _token, _amount, _account);

        uint256 bnZkeAmount = IRewardTracker(bonusZkeTracker).claimForAccount(_account, _account);
        if (bnZkeAmount > 0) {
            IRewardTracker(feeZkeTracker).stakeForAccount(_account, _account, bnZke, bnZkeAmount);
        }

        uint256 stakedBnZke = IRewardTracker(feeZkeTracker).depositBalances(_account, bnZke);
        if (stakedBnZke > 0) {
            uint256 reductionAmount = stakedBnZke.mul(_amount).div(balance);
            IRewardTracker(feeZkeTracker).unstakeForAccount(_account, bnZke, reductionAmount, _account);
            IMintable(bnZke).burn(_account, reductionAmount);
        }

        emit UnstakeZke(_account, _amount);
    }
}
