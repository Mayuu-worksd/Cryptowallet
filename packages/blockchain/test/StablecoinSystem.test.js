const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Multi-Currency Stablecoin System - Comprehensive Test Suite", function () {
  let MockUSDT, mockUSDT;
  let FiatTokenUpgradeable, impl;
  let FiatTokenUpgradeableV2, implV2;
  let TokenFactory, factory;
  let MultiCurrencyBridge, bridge;
  let ReserveConversion, conversion;

  let owner, admin, minter, burner, relayer, oracle, user1, user2;
  let chainId;

  // Constants
  const DECIMALS = 6;
  const THB_RATE = 36500000; // 36.5 represented with 6 decimals (1 USDT = 36.5 THB)
  const THB_ID = ethers.keccak256(ethers.toUtf8Bytes("THB"));

  before(async function () {
    const network = await ethers.provider.getNetwork();
    chainId = Number(network.chainId);
  });

  beforeEach(async function () {
    [owner, admin, minter, burner, relayer, oracle, user1, user2] = await ethers.getSigners();

    // 1. Deploy MockUSDT
    MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // 2. Deploy FiatTokenUpgradeable implementation
    FiatTokenUpgradeable = await ethers.getContractFactory("FiatTokenUpgradeable");
    impl = await FiatTokenUpgradeable.deploy();
    await impl.waitForDeployment();

    // 3. Deploy FiatTokenUpgradeableV2 implementation (for upgrade tests)
    FiatTokenUpgradeableV2 = await ethers.getContractFactory("FiatTokenUpgradeableV2");
    implV2 = await FiatTokenUpgradeableV2.deploy();
    await implV2.waitForDeployment();

    // 4. Deploy TokenFactory
    TokenFactory = await ethers.getContractFactory("TokenFactory");
    factory = await TokenFactory.deploy(owner.address, await impl.getAddress());
    await factory.waitForDeployment();

    // 5. Deploy MultiCurrencyBridge
    MultiCurrencyBridge = await ethers.getContractFactory("MultiCurrencyBridge");
    bridge = await MultiCurrencyBridge.deploy(admin.address);
    await bridge.waitForDeployment();
    // Grant relayer role to relayer signer
    await bridge.connect(admin).grantRole(await bridge.RELAYER_ROLE(), relayer.address);

    // 6. Deploy ReserveConversion
    ReserveConversion = await ethers.getContractFactory("ReserveConversion");
    conversion = await ReserveConversion.deploy(admin.address, await mockUSDT.getAddress());
    await conversion.waitForDeployment();
    // Grant oracle role to oracle signer
    await conversion.connect(admin).grantRole(await conversion.ORACLE_ROLE(), oracle.address);
  });

  describe("1. TokenFactory & Upgradeable Proxy Deployment", function () {
    it("Should deploy proxy pointing to implementation and initialize correctly", async function () {
      const tx = await factory.createToken(
        "Thai Baht",
        "THB",
        6,
        admin.address,
        minter.address,
        burner.address,
        ethers.parseUnits("1000", 6)
      );
      const receipt = await tx.wait();

      // Find TokenCreated event
      const event = receipt.logs
        .map((log) => {
          try { return factory.interface.parseLog(log); } catch (e) { return null; }
        })
        .find((parsed) => parsed && parsed.name === "TokenCreated");

      const tokenAddress = event.args.tokenAddress;
      const thb = await ethers.getContractAt("FiatTokenUpgradeable", tokenAddress);

      expect(await thb.name()).to.equal("Thai Baht");
      expect(await thb.symbol()).to.equal("THB");
      expect(await thb.decimals()).to.equal(6);
      expect(await thb.balanceOf(admin.address)).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should support createCurrency with default admin roles and no initial supply", async function () {
      const tx = await factory.createCurrency("Thai Baht", "THB", 6);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log) => {
          try { return factory.interface.parseLog(log); } catch (e) { return null; }
        })
        .find((parsed) => parsed && parsed.name === "TokenCreated");

      const tokenAddress = event.args.tokenAddress;
      const thb = await ethers.getContractAt("FiatTokenUpgradeable", tokenAddress);

      expect(await thb.name()).to.equal("Thai Baht");
      expect(await thb.balanceOf(owner.address)).to.equal(0);
      expect(await thb.hasRole(await thb.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    });

    it("Should prevent creating duplicate currency symbols", async function () {
      await factory.createCurrency("Thai Baht", "THB", 6);
      await expect(
        factory.createCurrency("Thai Baht V2", "THB", 6)
      ).to.be.revertedWith("TokenFactory: token symbol already deployed");
    });

    it("Should prevent non-owner from deploying currencies", async function () {
      await expect(
        factory.connect(user1).createCurrency("Thai Baht", "THB", 6)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("Should allow the owner to update the shared implementation address", async function () {
      const newImpl = await FiatTokenUpgradeable.deploy();
      await newImpl.waitForDeployment();
      await factory.setImplementation(await newImpl.getAddress());
      expect(await factory.implementation()).to.equal(await newImpl.getAddress());
    });
  });

  describe("2. FiatTokenUpgradeable Behavior", function () {
    let thb;

    beforeEach(async function () {
      const tx = await factory.createToken(
        "Thai Baht",
        "THB",
        6,
        admin.address,
        minter.address,
        burner.address,
        ethers.parseUnits("1000", 6)
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((l) => { try { return factory.interface.parseLog(l); } catch (e) { return null; } })
        .find((p) => p && p.name === "TokenCreated");
      thb = await ethers.getContractAt("FiatTokenUpgradeable", event.args.tokenAddress);
    });

    it("Should support transfer, transferFrom, approve, and allowance", async function () {
      await thb.connect(admin).transfer(user1.address, ethers.parseUnits("100", 6));
      expect(await thb.balanceOf(user1.address)).to.equal(ethers.parseUnits("100", 6));

      await thb.connect(user1).approve(user2.address, ethers.parseUnits("50", 6));
      expect(await thb.allowance(user1.address, user2.address)).to.equal(ethers.parseUnits("50", 6));

      await thb.connect(user2).transferFrom(user1.address, user2.address, ethers.parseUnits("30", 6));
      expect(await thb.balanceOf(user1.address)).to.equal(ethers.parseUnits("70", 6));
      expect(await thb.balanceOf(user2.address)).to.equal(ethers.parseUnits("30", 6));
    });

    it("Should allow controlled minting and burning by authorized roles", async function () {
      await thb.connect(minter).mint(user1.address, ethers.parseUnits("200", 6));
      expect(await thb.balanceOf(user1.address)).to.equal(ethers.parseUnits("200", 6));

      await thb.connect(user1).burn(ethers.parseUnits("50", 6));
      expect(await thb.balanceOf(user1.address)).to.equal(ethers.parseUnits("150", 6));

      // Custom burnFrom(uint256, string) matching PoC
      await thb.connect(user1).getFunction("burnFrom(uint256,string)")(ethers.parseUnits("50", 6), "Test Burn");
      expect(await thb.balanceOf(user1.address)).to.equal(ethers.parseUnits("100", 6));
    });

    it("Should execute controlled burnFrom(address, uint256)", async function () {
      await thb.connect(admin).transfer(user1.address, ethers.parseUnits("100", 6));

      // Standard user must spend allowance
      await thb.connect(user1).approve(user2.address, ethers.parseUnits("50", 6));
      await thb.connect(user2).getFunction("burnFrom(address,uint256)")(user1.address, ethers.parseUnits("20", 6));
      expect(await thb.balanceOf(user1.address)).to.equal(ethers.parseUnits("80", 6));
      expect(await thb.allowance(user1.address, user2.address)).to.equal(ethers.parseUnits("30", 6));

      // Burner role should burn without spending allowance
      await thb.connect(burner).getFunction("burnFrom(address,uint256)")(user1.address, ethers.parseUnits("30", 6));
      expect(await thb.balanceOf(user1.address)).to.equal(ethers.parseUnits("50", 6));
    });

    it("Should reject unauthorized mints and burns", async function () {
      await expect(
        thb.connect(user1).mint(user1.address, 100)
      ).to.be.revertedWithCustomError(thb, "AccessControlUnauthorizedAccount");

      await expect(
        thb.connect(user1).getFunction("burnFrom(address,uint256)")(user2.address, 100)
      ).to.be.reverted;
    });

    it("Should pause and unpause transfers by admin and block transfers when paused", async function () {
      await thb.connect(admin).pause();
      expect(await thb.paused()).to.be.true;

      await expect(
        thb.connect(admin).transfer(user1.address, 100)
      ).to.be.revertedWithCustomError(thb, "EnforcedPause");

      await thb.connect(admin).unpause();
      expect(await thb.paused()).to.be.false;

      await thb.connect(admin).transfer(user1.address, 100);
      expect(await thb.balanceOf(user1.address)).to.equal(100);
    });

    it("Should perform UUPS upgrade only by authorized admin", async function () {
      const upgradeProxy = await ethers.getContractAt("FiatTokenUpgradeableV2", await thb.getAddress());

      // Attempt to upgrade by user1 -> should revert
      await expect(
        upgradeProxy.connect(user1).upgradeToAndCall(await implV2.getAddress(), "0x")
      ).to.be.revertedWithCustomError(thb, "AccessControlUnauthorizedAccount");

      // Successful upgrade by admin
      await upgradeProxy.connect(admin).upgradeToAndCall(await implV2.getAddress(), "0x");
      expect(await upgradeProxy.version()).to.equal("V2");
    });
  });

  describe("3. MultiCurrencyBridge", function () {
    let thb;

    beforeEach(async function () {
      const tx = await factory.createToken(
        "Thai Baht",
        "THB",
        6,
        admin.address,
        minter.address,
        burner.address,
        ethers.parseUnits("1000", 6)
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((l) => { try { return factory.interface.parseLog(l); } catch (e) { return null; } })
        .find((p) => p && p.name === "TokenCreated");
      thb = await ethers.getContractAt("FiatTokenUpgradeable", event.args.tokenAddress);

      // Grant Bridge roles on THB token
      await thb.connect(admin).grantRole(await thb.MINTER_ROLE(), await bridge.getAddress());
      await thb.connect(admin).grantRole(await thb.BURNER_ROLE(), await bridge.getAddress());

      // Register THB in Bridge support
      await bridge.connect(admin).addSupportedToken(THB_ID, await thb.getAddress());
    });

    it("Should lock tokens successfully (burn on source chain)", async function () {
      const lockAmount = ethers.parseUnits("100", 6);
      await thb.connect(admin).transfer(user1.address, lockAmount);

      // User approves bridge
      await thb.connect(user1).approve(await bridge.getAddress(), lockAmount);

      const destChainId = chainId + 1; // simulation of another chain
      const recipient = user2.address;
      const nonce = 12345;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Lock tokens
      await expect(
        bridge.connect(user1).lock(THB_ID, lockAmount, destChainId, recipient, nonce, deadline)
      ).to.emit(bridge, "TokensLocked")
       .withArgs(THB_ID, await thb.getAddress(), user1.address, recipient, lockAmount, destChainId, nonce, deadline);

      expect(await thb.balanceOf(user1.address)).to.equal(0);
    });

    it("Should prevent duplicate locks with the same nonce", async function () {
      const lockAmount = ethers.parseUnits("10", 6);
      await thb.connect(admin).transfer(user1.address, lockAmount * 2n);
      await thb.connect(user1).approve(await bridge.getAddress(), lockAmount * 2n);

      const destChainId = chainId + 1;
      const nonce = 555;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await bridge.connect(user1).lock(THB_ID, lockAmount, destChainId, user2.address, nonce, deadline);

      await expect(
        bridge.connect(user1).lock(THB_ID, lockAmount, destChainId, user2.address, nonce, deadline)
      ).to.be.revertedWith("Bridge: nonce already used");
    });

    it("Should prevent lock when past deadline", async function () {
      const lockAmount = ethers.parseUnits("10", 6);
      await thb.connect(admin).transfer(user1.address, lockAmount);
      await thb.connect(user1).approve(await bridge.getAddress(), lockAmount);

      const destChainId = chainId + 1;
      const nonce = 666;
      const deadline = Math.floor(Date.now() / 1000) - 60; // 1 minute in the past

      await expect(
        bridge.connect(user1).lock(THB_ID, lockAmount, destChainId, user2.address, nonce, deadline)
      ).to.be.revertedWith("Bridge: transaction expired");
    });

    it("Should release tokens successfully with relayer signature (mint on destination chain)", async function () {
      const releaseAmount = ethers.parseUnits("100", 6);
      const sourceChainId = chainId + 1;
      const recipient = user2.address;
      const nonce = 999;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Encode the data to sign
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const messageHash = ethers.keccak256(
        abiCoder.encode(
          ["uint256", "bytes32", "uint256", "uint256", "address", "uint256", "uint256"],
          [chainId, THB_ID, releaseAmount, sourceChainId, recipient, nonce, deadline]
        )
      );
      
      const messageHashBytes = ethers.getBytes(messageHash);
      const signature = await relayer.signMessage(messageHashBytes);

      // Release tokens on destination chain
      await expect(
        bridge.connect(user1).release(THB_ID, releaseAmount, sourceChainId, recipient, nonce, deadline, signature)
      ).to.emit(bridge, "TokensReleased")
       .withArgs(THB_ID, await thb.getAddress(), recipient, releaseAmount, sourceChainId, nonce);

      expect(await thb.balanceOf(recipient)).to.equal(releaseAmount);
    });

    it("Should prevent double execution of release (replay attack protection)", async function () {
      const releaseAmount = ethers.parseUnits("50", 6);
      const sourceChainId = chainId + 1;
      const recipient = user2.address;
      const nonce = 888;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const messageHash = ethers.keccak256(
        abiCoder.encode(
          ["uint256", "bytes32", "uint256", "uint256", "address", "uint256", "uint256"],
          [chainId, THB_ID, releaseAmount, sourceChainId, recipient, nonce, deadline]
        )
      );
      const messageHashBytes = ethers.getBytes(messageHash);
      const signature = await relayer.signMessage(messageHashBytes);

      // First release
      await bridge.connect(user1).release(THB_ID, releaseAmount, sourceChainId, recipient, nonce, deadline, signature);

      // Attempt second release
      await expect(
        bridge.connect(user1).release(THB_ID, releaseAmount, sourceChainId, recipient, nonce, deadline, signature)
      ).to.be.revertedWith("Bridge: transaction already processed");
    });

    it("Should reject release with invalid relayer signature", async function () {
      const releaseAmount = ethers.parseUnits("50", 6);
      const sourceChainId = chainId + 1;
      const recipient = user2.address;
      const nonce = 777;
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const messageHash = ethers.keccak256(
        abiCoder.encode(
          ["uint256", "bytes32", "uint256", "uint256", "address", "uint256", "uint256"],
          [chainId, THB_ID, releaseAmount, sourceChainId, recipient, nonce, deadline]
        )
      );
      const messageHashBytes = ethers.getBytes(messageHash);
      
      // Sign with an unauthorized user wallet instead of the relayer
      const signature = await user1.signMessage(messageHashBytes);

      await expect(
        bridge.connect(user1).release(THB_ID, releaseAmount, sourceChainId, recipient, nonce, deadline, signature)
      ).to.be.revertedWith("Bridge: invalid relayer signature");
    });
  });

  describe("4. ReserveConversion", function () {
    let thb;

    beforeEach(async function () {
      const tx = await factory.createToken(
        "Thai Baht",
        "THB",
        6,
        admin.address,
        minter.address,
        burner.address,
        ethers.parseUnits("1000", 6)
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((l) => { try { return factory.interface.parseLog(l); } catch (e) { return null; } })
        .find((p) => p && p.name === "TokenCreated");
      thb = await ethers.getContractAt("FiatTokenUpgradeable", event.args.tokenAddress);

      // Grant Conversion roles on THB
      await thb.connect(admin).grantRole(await thb.MINTER_ROLE(), await conversion.getAddress());
      await thb.connect(admin).grantRole(await thb.BURNER_ROLE(), await conversion.getAddress());

      // Register THB in ReserveConversion
      await conversion.connect(admin).configureToken(THB_ID, await thb.getAddress());
      // Set FX Rate (1 USDT = 36.5 THB)
      await conversion.connect(oracle).setRate(THB_ID, THB_RATE);
    });

    it("Should swap USDT to Stablecoin correctly", async function () {
      const usdtAmount = ethers.parseUnits("10", 6); // 10 USDT
      
      // Mint MockUSDT to user1 and approve ReserveConversion
      await mockUSDT.mint(user1.address, usdtAmount);
      await mockUSDT.connect(user1).approve(await conversion.getAddress(), usdtAmount);

      // Swap
      await expect(
        conversion.connect(user1).swapUSDTToStablecoin(THB_ID, usdtAmount)
      ).to.emit(conversion, "SwapUSDTToStable")
       .withArgs(THB_ID, user1.address, usdtAmount, ethers.parseUnits("365", 6));

      expect(await mockUSDT.balanceOf(user1.address)).to.equal(0);
      expect(await mockUSDT.balanceOf(await conversion.getAddress())).to.equal(usdtAmount);
      expect(await thb.balanceOf(user1.address)).to.equal(ethers.parseUnits("365", 6));
    });

    it("Should swap Stablecoin to USDT correctly", async function () {
      const stableAmount = ethers.parseUnits("365", 6); // 365 THB
      
      // Setup: fund ReserveConversion with USDT and User1 with THB
      await mockUSDT.mint(await conversion.getAddress(), ethers.parseUnits("100", 6));
      await thb.connect(minter).mint(user1.address, stableAmount);

      // User1 approves ReserveConversion to burn THB (or since conversion holds BURNER_ROLE, it doesn't need allowance)
      // Let's verify it works directly
      await expect(
        conversion.connect(user1).swapStablecoinToUSDT(THB_ID, stableAmount)
      ).to.emit(conversion, "SwapStableToUSDT")
       .withArgs(THB_ID, user1.address, stableAmount, ethers.parseUnits("10", 6));

      expect(await thb.balanceOf(user1.address)).to.equal(0);
      expect(await mockUSDT.balanceOf(user1.address)).to.equal(ethers.parseUnits("10", 6));
      expect(await mockUSDT.balanceOf(await conversion.getAddress())).to.equal(ethers.parseUnits("90", 6));
    });

    it("Should revert swap if reserve has insufficient USDT", async function () {
      const stableAmount = ethers.parseUnits("365", 6);
      await thb.connect(minter).mint(user1.address, stableAmount);

      // Reserve conversion contract has 0 USDT reserve
      await expect(
        conversion.connect(user1).swapStablecoinToUSDT(THB_ID, stableAmount)
      ).to.be.revertedWith("ReserveConversion: insufficient USDT reserves");
    });

    it("Should revert rate updates by unauthorized users", async function () {
      await expect(
        conversion.connect(user1).setRate(THB_ID, 40000000)
      ).to.be.revertedWithCustomError(conversion, "AccessControlUnauthorizedAccount");
    });

    it("Should swap Stablecoin to Stablecoin atomically", async function () {
      // 1. Create a second token (e.g. PKR) via factory
      const tx = await factory.createToken("Pakistani Rupee", "PKR", 6, admin.address, minter.address, burner.address, 0);
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((l) => { try { return factory.interface.parseLog(l); } catch (e) { return null; } })
        .find((p) => p && p.name === "TokenCreated");
      const pkr = await ethers.getContractAt("FiatTokenUpgradeable", event.args.tokenAddress);

      // 2. Grant roles and configure in ReserveConversion
      await pkr.connect(admin).grantRole(await pkr.MINTER_ROLE(), await conversion.getAddress());
      await pkr.connect(admin).grantRole(await pkr.BURNER_ROLE(), await conversion.getAddress());
      
      const PKR_ID = ethers.keccak256(ethers.toUtf8Bytes("PKR"));
      await conversion.connect(admin).configureToken(PKR_ID, await pkr.getAddress());
      
      // Set exchange rate (1 USDT = 280 PKR -> rate = 280 * 10^6)
      const PKR_RATE = 280000000;
      await conversion.connect(oracle).setRate(PKR_ID, PKR_RATE);

      // 3. Setup: Mint THB to user1
      const thbAmount = ethers.parseUnits("365", 6); // 365 THB
      await thb.connect(minter).mint(user1.address, thbAmount);

      // 4. Swap THB -> PKR atomically
      await expect(
        conversion.connect(user1).swapStablecoinToStablecoin(THB_ID, PKR_ID, thbAmount)
      ).to.emit(conversion, "SwapStableToStable")
       .withArgs(THB_ID, PKR_ID, user1.address, thbAmount, ethers.parseUnits("2800", 6));

      expect(await thb.balanceOf(user1.address)).to.equal(0);
      expect(await pkr.balanceOf(user1.address)).to.equal(ethers.parseUnits("2800", 6));
    });

    it("Should revert if rate has expired (stale rates protection)", async function () {
      // Advance time by 24h + 1s to expire the rate
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine");

      const usdtAmount = ethers.parseUnits("10", 6);
      await mockUSDT.mint(user1.address, usdtAmount);
      await mockUSDT.connect(user1).approve(await conversion.getAddress(), usdtAmount);

      await expect(
        conversion.connect(user1).swapUSDTToStablecoin(THB_ID, usdtAmount)
      ).to.be.revertedWith("ReserveConversion: rate expired");
    });

    it("Should enforce rate deviation protection on setRate", async function () {
      // Attempt to update THB rate from 36.5 to 42.0 (15% deviation, default limit is 10%)
      await expect(
        conversion.connect(oracle).setRate(THB_ID, 42000000)
      ).to.be.revertedWith("ReserveConversion: rate deviation too high");
    });

    it("Should allow admin to setRateOverride to bypass deviation checks", async function () {
      await expect(
        conversion.connect(admin).setRateOverride(THB_ID, 42000000)
      ).to.emit(conversion, "RateUpdated")
       .withArgs(THB_ID, THB_RATE, 42000000);
      
      expect(await conversion.fxRates(THB_ID)).to.equal(42000000);
    });

    it("Should enforce maximum USDT conversion limit", async function () {
      // Set limit to 5 USDT
      await conversion.connect(admin).setMaxUSDTConversionLimit(ethers.parseUnits("5", 6));

      const usdtAmount = ethers.parseUnits("10", 6);
      await mockUSDT.mint(user1.address, usdtAmount);
      await mockUSDT.connect(user1).approve(await conversion.getAddress(), usdtAmount);

      await expect(
        conversion.connect(user1).swapUSDTToStablecoin(THB_ID, usdtAmount)
      ).to.be.revertedWith("ReserveConversion: exceeds maximum swap limit");
    });
  });
});
