const fs = require('fs');
const path = require('path');

// Load solc from VS Code Solidity extension
const solcPath = 'C:/Users/KARTHICK MAYUR/.vscode/extensions/juanblanco.solidity-0.0.187/node_modules/solc';
const solc = require(solcPath);

function findImports(importPath) {
  try {
    if (importPath.startsWith('@openzeppelin/')) {
      const localPath = path.resolve(__dirname, '../node_modules', importPath);
      if (fs.existsSync(localPath)) {
        return { contents: fs.readFileSync(localPath, 'utf8') };
      }
    } else {
      const relativePath = path.resolve(__dirname, '../contracts', importPath);
      if (fs.existsSync(relativePath)) {
        return { contents: fs.readFileSync(relativePath, 'utf8') };
      }
    }
  } catch (err) {
    return { error: err.message };
  }
  return { error: 'File not found: ' + importPath };
}

const fiatTokenSource = fs.readFileSync(path.resolve(__dirname, '../contracts/FiatToken.sol'), 'utf8');
const tokenFactorySource = fs.readFileSync(path.resolve(__dirname, '../contracts/TokenFactory.sol'), 'utf8');
const mockUsdtSource = fs.readFileSync(path.resolve(__dirname, '../contracts/MockUSDT.sol'), 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'FiatToken.sol': { content: fiatTokenSource },
    'TokenFactory.sol': { content: tokenFactorySource },
    'MockUSDT.sol': { content: mockUsdtSource }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    }
  }
};

console.log('Compiling contracts locally using solc 0.8.29...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  let hasErrors = false;
  output.errors.forEach(err => {
    console.log(err.formattedMessage);
    if (err.severity === 'error') hasErrors = true;
  });
  if (hasErrors) {
    console.error('❌ Compilation failed!');
    process.exit(1);
  }
}

const artifactsDir = path.resolve(__dirname, '../artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

// Write FiatToken artifact
const fiatTokenAbi = output.contracts['FiatToken.sol']['FiatToken'].abi;
const fiatTokenBytecode = output.contracts['FiatToken.sol']['FiatToken'].evm.bytecode.object;
fs.writeFileSync(
  path.join(artifactsDir, 'FiatToken.json'),
  JSON.stringify({ abi: fiatTokenAbi, bytecode: fiatTokenBytecode }, null, 2)
);
console.log('FiatToken artifact written to artifacts/FiatToken.json');

// Write TokenFactory artifact
const tokenFactoryAbi = output.contracts['TokenFactory.sol']['TokenFactory'].abi;
const tokenFactoryBytecode = output.contracts['TokenFactory.sol']['TokenFactory'].evm.bytecode.object;
fs.writeFileSync(
  path.join(artifactsDir, 'TokenFactory.json'),
  JSON.stringify({ abi: tokenFactoryAbi, bytecode: tokenFactoryBytecode }, null, 2)
);
console.log('TokenFactory artifact written to artifacts/TokenFactory.json');

// Write MockUSDT artifact
const mockUsdtAbi = output.contracts['MockUSDT.sol']['MockUSDT'].abi;
const mockUsdtBytecode = output.contracts['MockUSDT.sol']['MockUSDT'].evm.bytecode.object;
fs.writeFileSync(
  path.join(artifactsDir, 'MockUSDT.json'),
  JSON.stringify({ abi: mockUsdtAbi, bytecode: mockUsdtBytecode }, null, 2)
);
console.log('MockUSDT artifact written to artifacts/MockUSDT.json');

console.log('✅ Compilation completed successfully.');
