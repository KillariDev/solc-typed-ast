// ------------------------------------------------------------
// test/samples/solidity/statements/variable_declaration_050.sol
// ------------------------------------------------------------
pragma solidity ^0.5.0;

contract TestVariableDeclarationStatement {
    int internal a = 1;
    int internal b;

    function single(int x) public {
        int c = 0;
    }

    function multiple() public {
        int x;
        (int y, , int z) = (1, "x", 2);
        x = 0;
    }

    function nested() public {
        {
            int j = 1;
        }
        if (true) {
            string memory test = "test";
        }
        for (int i = 0; i < 5; i++) {
            string memory a = "";
        }
    }
}
