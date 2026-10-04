// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ApprovaAuthorization {
    using ECDSA for bytes32;

    bytes32 public constant AUTHORIZATION_TYPEHASH =
        keccak256(
            "Authorization(bytes32 requestId,address account,uint256 chainId,address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)"
        );

    bytes32 public immutable DOMAIN_SEPARATOR;

    mapping(bytes32 => bool) public usedRequest;
    mapping(address => uint256) public nonces;

    event AuthorizationConsumed(
        bytes32 indexed requestId,
        address indexed account,
        address indexed target,
        uint256 value,
        bytes32 dataHash
    );

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("Approva")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function authorizationDigest(
        bytes32 requestId,
        address account,
        uint256 chainId,
        address target,
        uint256 value,
        bytes32 dataHash,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                AUTHORIZATION_TYPEHASH,
                requestId,
                account,
                chainId,
                target,
                value,
                dataHash,
                nonce,
                deadline
            )
        );

        return keccak256(
            abi.encodePacked("\\x19\\x01", DOMAIN_SEPARATOR, structHash)
        );
    }

    function consume(
        bytes32 requestId,
        address account,
        uint256 chainId,
        address target,
        uint256 value,
        bytes32 dataHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external returns (bool) {
        require(block.timestamp <= deadline, "authorization expired");
        require(!usedRequest[requestId], "authorization already consumed");
        require(chainId == block.chainid, "wrong chain");
        require(nonce == nonces[account], "wrong nonce");

        bytes32 digest = authorizationDigest(
            requestId,
            account,
            chainId,
            target,
            value,
            dataHash,
            nonce,
            deadline
        );

        require(digest.recover(signature) == account, "invalid signer");

        usedRequest[requestId] = true;
        nonces[account] = nonce + 1;

        emit AuthorizationConsumed(
            requestId,
            account,
            target,
            value,
            dataHash
        );

        return true;
    }
}
