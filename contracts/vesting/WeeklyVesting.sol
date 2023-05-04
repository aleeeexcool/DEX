// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/access/access_0_8_0/Ownable_0_8_0.sol";

contract WeeklyVesting is Ownable_0_8_0 {
    uint256 public vestingWeeks;
    uint256 public tokenPrice;
    uint256 public maxWxtVesting;
    uint256 public vestingStart;
    IERC20 public wxt;
    IERC20 public usdc;

    uint256 public totalWxtPurchased;
    uint256 private constant WXT_DECIMALS = 18;

    struct Participant {
        uint256 wxtPurchased;
        uint256 wxtClaimed;
        uint256 lastClaimed;
    }

    mapping(address => Participant) public participants;
    mapping(address => bool) public pausedClaiming;

    event WxtPurchased(address indexed buyer, uint256 amount);
    event WxtClaimed(address indexed claimer, uint256 amount);

    constructor(
        IERC20 _wxt,
        IERC20 _usdc,
        uint256 _vestingWeeks,
        uint256 _tokenPrice,
        uint256 _maxWxtVesting,
        uint256 _vestingStart
    ) {
        wxt = _wxt;
        usdc = _usdc;
        vestingWeeks = _vestingWeeks;
        tokenPrice = _tokenPrice;
        maxWxtVesting = _maxWxtVesting;
        vestingStart = _vestingStart;
    }

    function setVestingStart(uint256 _vestingStart) external {
        _checkOwner();
        require(block.timestamp < vestingStart, "Vesting has already started");
        require(_vestingStart > vestingStart, "You can not start vesting retroactively");
        vestingStart = _vestingStart;
    }

    function setVestingWeeks(uint256 _vestingWeeks) external {
        _checkOwner();
        vestingWeeks = _vestingWeeks;
    }

    function setTokenPrice(uint256 _tokenPrice) external {
        _checkOwner();
        tokenPrice = _tokenPrice;
    }

    function setMaxWxtVesting(uint256 _maxWxtVesting) external {
        _checkOwner();
        maxWxtVesting = _maxWxtVesting;
    }

    function buyTokens(uint256 tokenAmount) external {
        require(
            block.timestamp < vestingStart,
            "Token purchase not allowed after vesting starts"
        );
        require(
            totalWxtPurchased + tokenAmount <= maxWxtVesting,
            "Exceeds maximum WXT vesting limit"
        );

        uint256 requiredUsdc = (tokenAmount * tokenPrice) /
            (10 ** WXT_DECIMALS);

        require(requiredUsdc > 0, "tokenAmount too small");
        usdc.transferFrom(msg.sender, address(this), requiredUsdc);

        Participant storage participant = participants[msg.sender];
        participant.wxtPurchased += tokenAmount;

        totalWxtPurchased += tokenAmount;

        emit WxtPurchased(msg.sender, tokenAmount);
    }

    function claimTokens() external {
        require(!pausedClaiming[msg.sender], "Claiming is paused for this user");
        require(block.timestamp >= vestingStart, "Vesting has not started yet");

        Participant storage participant = participants[msg.sender];

        uint256 tokensAvailable = getAvailableTokens(msg.sender);
        require(tokensAvailable > 0, "No tokens available to claim");

        participant.wxtClaimed += tokensAvailable;
        participant.lastClaimed = block.timestamp;
        wxt.transfer(msg.sender, tokensAvailable);

        emit WxtClaimed(msg.sender, tokensAvailable);
    }

    function getAvailableTokens(address user) public view returns (uint256) {
        if (block.timestamp < vestingStart) {
            return 0;
        }

        Participant storage participant = participants[user];
        uint256 weeksPassed = (block.timestamp -
            max(participant.lastClaimed, vestingStart)) / (86400 * 7);

        if (weeksPassed == 0) {
            return 0;
        }

        uint256 tokensPerWeek = participant.wxtPurchased / vestingWeeks;
        uint256 tokensToClaim = tokensPerWeek * weeksPassed;

        return
            (participant.wxtClaimed + tokensToClaim > participant.wxtPurchased)
                ? participant.wxtPurchased - participant.wxtClaimed
                : tokensToClaim;
    }

    function max(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a : b;
    }

    function withdrawTokens(
        address _tokenAddress,
        uint256 _amount
    ) external {
        _checkOwner();
        IERC20 _token = IERC20(_tokenAddress);
        _token.transfer(owner(), _amount);
    }

    function pauseClaiming(address user) external {
        _checkOwner();
        pausedClaiming[user] = true;
    }

    function unpauseClaiming(address user) external {
        _checkOwner();
        pausedClaiming[user] = false;
    }
}

