// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ApprovaAuthorization} from "../src/ApprovaAuthorization.sol";
import {ApprovaForwarder} from "../src/ApprovaForwarder.sol";

contract Deploy is Script {
    function run() external returns (ApprovaAuthorization authorization, ApprovaForwarder forwarder) {
        vm.startBroadcast();
        authorization = new ApprovaAuthorization();
        forwarder = new ApprovaForwarder();
        vm.stopBroadcast();
    }
}
