const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenFactory & FiatToken Unit Tests", function () {
  let TokenFactory;
  let factory;
  let owner;
  let admin;
  let minter;
  let burner;
  let user1;
  let user2;

  beforeEach(async function () {
    // Get signers
    [owner, admin, minter, burner, user1, user2] = await ethers.getSigners();

    // Deploy Implementation first
    const FiatTokenUpgradeable = await ethers.getContractFactory("FiatTokenUpgradeable");
    const impl = await FiatTokenUpgradeable.deploy();
    await impl.waitForDeployment();

    // Deploy Factory
    TokenFactory = await ethers.getContractFactory("TokenFactory");
    factory = await TokenFactory.deploy(owner.address, await impl.getAddress());
    await factory.waitForDeployment();
  });

  describe("Factory Deployment", function () {
    it("Should set the correct factory owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should start with 0 deployed tokens", async function () {
      expect(await factory.getDeployedTokensCount()).to.equal(0);
    });
  });

  describe("Token Deployment via Factory", function () {
    let tokenAddress;
    let token;

    beforeEach(async function () {
      // Deploy THB via Factory
      const tx = await factory.createToken(
        "Thai Baht",
        "THB",
        6,
        admin.address,
        minter.address,
        burner.address,
        ethers.parseUnits("1000", 6) // Initial supply of 1000 THB
      );
      const receipt = await tx.wait();

      // Find event to get token address
      const event = receipt.logs
        .map((log) => {
          try {
            return factory.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "TokenCreated");

      tokenAddress = event.args.tokenAddress;
      token = await ethers.getContractAt("FiatTokenUpgradeable", tokenAddress);
    });

    it("Should record the deployed token address in factory mapping and array", async function () {
      expect(await factory.getDeployedTokensCount()).to.equal(1);
      expect(await factory.deployedTokens(0)).to.equal(tokenAddress);
      expect(await factory.tokensBySymbol("THB")).to.equal(tokenAddress);
    });

    it("Should initialize THB token metadata correctly", async function () {
      expect(await token.name()).to.equal("Thai Baht");
      expect(await token.symbol()).to.equal("THB");
      expect(await token.decimals()).to.equal(6);
    });

    it("Should mint the initial supply to the admin address", async function () {
      const adminBal = await token.balanceOf(admin.address);
      expect(adminBal).to.equal(ethers.parseUnits("1000", 6));
      expect(await token.totalSupply()).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should set up AccessControl roles correctly", async function () {
      const adminRole = await token.DEFAULT_ADMIN_ROLE();
      const minterRole = await token.MINTER_ROLE();
      const burnerRole = await token.BURNER_ROLE();

      expect(await token.hasRole(adminRole, admin.address)).to.be.true;
      expect(await token.hasRole(minterRole, minter.address)).to.be.true;
      expect(await token.hasRole(burnerRole, burner.address)).to.be.true;

      // Deployer/Owner should not have admin role unless explicitly granted
      expect(await token.hasRole(adminRole, owner.address)).to.be.false;
    });

    it("Should allow the minter to mint new tokens", async function () {
      await token.connect(minter).mint(user1.address, ethers.parseUnits("500", 6));
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("500", 6));
      expect(await token.totalSupply()).to.equal(ethers.parseUnits("1500", 6));
    });

    it("Should reject mint attempts from unauthorized accounts", async function () {
      await expect(
        token.connect(user1).mint(user1.address, ethers.parseUnits("500", 6))
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should allow users to burn their own tokens using standard burn", async function () {
      // Transfer tokens from admin to user1 first
      await token.connect(admin).transfer(user1.address, ethers.parseUnits("200", 6));
      
      // Burn tokens
      await token.connect(user1).burn(ethers.parseUnits("50000000", 0)); // Burn 50 base units (50.000000 THB)
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("150", 6));
    });

    it("Should support custom burnFrom(amount, reason) and emit Burned event", async function () {
      await token.connect(admin).transfer(user1.address, ethers.parseUnits("200", 6));
      
      await expect(token.connect(user1).getFunction("burnFrom(uint256,string)")(ethers.parseUnits("100", 6), "Test Burn"))
        .to.emit(token, "Burned")
        .withArgs(user1.address, ethers.parseUnits("100", 6), "Test Burn");
        
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("100", 6));
    });

    it("Should allow standard burnFrom with allowance", async function () {
      await token.connect(admin).transfer(user1.address, ethers.parseUnits("200", 6));
      await token.connect(user1).approve(user2.address, ethers.parseUnits("100", 6));

      await token.connect(user2).getFunction("burnFrom(address,uint256)")(user1.address, ethers.parseUnits("50", 6));
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("150", 6));
      expect(await token.allowance(user1.address, user2.address)).to.equal(ethers.parseUnits("50", 6));
    });

    it("Should fail standard burnFrom if allowance is insufficient", async function () {
      await token.connect(admin).transfer(user1.address, ethers.parseUnits("200", 6));
      await expect(
        token.connect(user2).getFunction("burnFrom(address,uint256)")(user1.address, ethers.parseUnits("50", 6))
      ).to.be.reverted;
    });

    it("Should allow admin to pause and unpause transfers", async function () {
      await token.connect(admin).transfer(user1.address, ethers.parseUnits("200", 6));
      
      // Pause
      await token.connect(admin).pause();
      expect(await token.paused()).to.be.true;

      // Transfers should fail when paused
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseUnits("50", 6))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");

      // Unpause
      await token.connect(admin).unpause();
      expect(await token.paused()).to.be.false;

      // Transfers should succeed now
      await token.connect(user1).transfer(user2.address, ethers.parseUnits("50", 6));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseUnits("50", 6));
    });

    it("Should prevent unauthorized pause/unpause", async function () {
      await expect(
        token.connect(user1).pause()
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Factory Duplicate / Error Safeguards", function () {
    it("Should prevent deploying duplicate symbols", async function () {
      await factory.createToken(
        "Thai Baht",
        "THB",
        6,
        admin.address,
        minter.address,
        burner.address,
        0
      );

      await expect(
        factory.createToken(
          "New Thai Baht",
          "THB",
          6,
          admin.address,
          minter.address,
          burner.address,
          0
        )
      ).to.be.revertedWith("TokenFactory: token symbol already deployed");
    });

    it("Should reject deploying with empty metadata parameters", async function () {
      await expect(
        factory.createToken(
          "",
          "THB",
          6,
          admin.address,
          minter.address,
          burner.address,
          0
        )
      ).to.be.revertedWith("TokenFactory: empty name");

      await expect(
        factory.createToken(
          "Thai Baht",
          "",
          6,
          admin.address,
          minter.address,
          burner.address,
          0
        )
      ).to.be.revertedWith("TokenFactory: empty symbol");
    });
  });
});
