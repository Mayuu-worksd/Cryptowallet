// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FiatTokenUpgradeable} from "./FiatTokenUpgradeable.sol";

/**
 * @title FiatTokenUpgradeableV2
 * @dev Simple extension of FiatTokenUpgradeable to test UUPS upgrade execution.
 */
contract FiatTokenUpgradeableV2 is FiatTokenUpgradeable {
    /**
     * @dev A new function introduced in the V2 implementation.
     */
    function version() external pure returns (string memory) {
        return "V2";
    }
}
