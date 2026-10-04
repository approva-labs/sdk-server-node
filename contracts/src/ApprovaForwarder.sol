// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ApprovaForwarder {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
        uint256 deadline;
    }

    bytes32 public constant TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data,uint256 deadline)"
        );

    mapping(address => uint256) public nonces;
    bytes32 public immutable DOMAIN_SEPARATOR;

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("ApprovaForwarder")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function execute(
        ForwardRequest calldata req,
        bytes calldata signature
    ) external payable returns (bool, bytes memory) {
        require(block.timestamp <= req.deadline, "expired");
        require(req.nonce == nonces[req.from], "invalid nonce");

        bytes32 structHash = keccak256(
            abi.encode(
                TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data),
                req.deadline
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\\x19\\x01", DOMAIN_SEPARATOR, structHash)
        );

        require(digest.recover(signature) == req.from, "invalid signer");

        nonces[req.from]++;

        (bool success, bytes memory returndata) = req.to.call{value: req.value}(
            req.data
        );

        return (success, returndata);
    }
}
