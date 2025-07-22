const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ MongoDB connection
mongoose.connect('mongodb+srv://edric:wined@cluster0.49d4fas.mongodb.net/metamask', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// ✅ Wallet Schema
const walletSchema = new mongoose.Schema({
  userId: String,
  username: String,
  address: String,
  mnemonic: String,
  encryptedJson: String
});
const Wallet = mongoose.model('Wallet', walletSchema);

// ✅ BSC Testnet Provider
const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");

// ✅ Contract Configurations
const USDT_CONTRACT_ADDRESS = "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F";
const USDC_CONTRACT_ADDRESS = "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

// ✅ Save Wallet
app.post('/api/wallets', async (req, res) => {
  try {
    const wallet = new Wallet(req.body);
    await wallet.save();
    res.status(201).json({ message: 'Wallet saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get Wallet by Username
app.get('/api/wallets/:username', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ username: req.params.username });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Verify Transaction Hash
app.post('/api/verify-tx', async (req, res) => {
  const { txHash } = req.body;
  if (!txHash) return res.status(400).send("Transaction hash required");

  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return res.status(404).send("Transaction not found");

    // Wait for transaction to be mined (timeout: 60s)
    const receipt = await provider.waitForTransaction(txHash, 1, 60000);
    if (!receipt) return res.status(404).send("Transaction not yet mined");

    let token = "BNB";
    let amount;
    let toAddress = tx.to;

    if (tx.to.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase() && tx.data !== "0x") {
      token = "USDT";
      const iface = new ethers.Interface(ERC20_ABI);
      const decoded = iface.decodeFunctionData("transfer", tx.data);
      amount = ethers.formatUnits(decoded.amount, 18);
      toAddress = decoded.to;

    } else if (tx.to.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase() && tx.data !== "0x") {
      token = "USDC";
      const iface = new ethers.Interface(ERC20_ABI);
      const decoded = iface.decodeFunctionData("transfer", tx.data);
      amount = ethers.formatUnits(decoded.amount, 18);
      toAddress = decoded.to;

    } else {
      amount = ethers.formatEther(tx.value);
    }

    // Calculate gas fee in BNB
    const gasUsed = receipt.gasUsed;
    const effectiveGasPrice = receipt.effectiveGasPrice || tx.gasPrice;
    const gasFee = ethers.formatEther(gasUsed * effectiveGasPrice);

    res.send({
      from: tx.from,
      to: toAddress,
      amount,
      token,
      status: receipt.status === 1 ? "success" : "failed",
      blockNumber: receipt.blockNumber,
      gasUsed: gasUsed.toString(),
      gasFee
    });

  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).send("Verification failed");
  }
});

// ✅ Start Server
app.listen(5000, () => console.log("🚀 Server running at http://localhost:5000"));
