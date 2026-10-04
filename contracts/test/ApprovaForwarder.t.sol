// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ApprovaForwarder} from "../src/ApprovaForwarder.sol";

contract ApprovaForwarderTest is Test {
    ApprovaForwarder internal forwarder;

    function setUp() public {
        forwarder = new ApprovaForwarder();
    }

    function testInitialNonceIsZero() public view {
        assertEq(forwarder.nonces(address(1)), 0);
    }
}
