// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ApprovaAuthorization} from "../src/ApprovaAuthorization.sol";

contract ApprovaAuthorizationTest is Test {
    ApprovaAuthorization internal authorization;

    function setUp() public {
        authorization = new ApprovaAuthorization();
    }

    function testDomainExists() public view {
        assertTrue(authorization.DOMAIN_SEPARATOR() != bytes32(0));
    }
}
