// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IRewardRouterV2 {
    function feeZlpTracker() external view returns (address);
    function stakedZlpTracker() external view returns (address);
}
