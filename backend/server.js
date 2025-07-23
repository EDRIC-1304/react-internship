// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { ethers } = require('ethers');

// Add these
const USDT_CONTRACT_ADDRESS = '0x787A697324dbA4AB965C58CD33c13ff5eeA6295F';
const USDC_CONTRACT_ADDRESS = '0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1';

// Set up provider
const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");


const app = express();
app.use(cors());
app.use(express.json());

// Connect MongoDB
mongoose.connect('mongodb+srv://edric:wined@cluster0.49d4fas.mongodb.net/metamask')
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Error:", err));

// Wallet Schema
const walletSchema = new mongoose.Schema({
  userId: String,
  username: String,
  address: String,
  mnemonic: String,
  encryptedJson: String,
});
const Wallet = mongoose.model('Wallet', walletSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  txHash: String,
  from: String,
  to: String,
  amount: String,
  token: String,
  blockNumber: Number,
  gasFee: String,
  timestamp: String
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// Endpoint to create wallet
app.post('/api/wallets', async (req, res) => {
  try {
    const { userId, username, address, mnemonic, encryptedJson } = req.body;
    const wallet = new Wallet({ userId, username, address, mnemonic, encryptedJson });
    await wallet.save();
    res.status(201).send({ message: 'Wallet saved successfully' });
  } catch (err) {
    res.status(500).send({ error: 'Error saving wallet' });
  }
});

// Endpoint to find wallet
app.get('/api/wallets/:username', async (req, res) => {
  try {
    const found = await Wallet.findOne({ username: req.params.username });
    if (!found) return res.status(404).send({ error: 'Wallet not found' });
    res.send(found);
  } catch {
    res.status(500).send({ error: 'Error fetching wallet' });
  }
});

// Verify transaction
app.post("/api/verify-tx", async (req, res) => {
  const { txHash } = req.body;

  try {
    // Check if the hash already exists in the DB
    const existing = await Transaction.findOne({ txHash: txHash.toLowerCase() });

    if (existing) {
      return res.json(existing); // Already verified
    }

    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!tx || !receipt || !receipt.status) {
      return res.status(400).json({ error: "Transaction not found or failed" });
    }

    const block = await provider.getBlock(receipt.blockNumber);
    const gasUsed = receipt.gasUsed;
    const gasPrice = tx.gasPrice;
    const gasFee = ethers.formatEther(gasUsed * gasPrice);

    let token = "BNB";
    let amount = ethers.formatEther(tx.value);

    if (tx.data !== "0x") {
      const inputSig = tx.data.slice(0, 10);
      if (inputSig === "0xa9059cbb") {
        const recipient = "0x" + tx.data.slice(34, 74);
        const valueHex = "0x" + tx.data.slice(74);
        const decimals = 18;
        amount = ethers.formatUnits(valueHex, decimals);

        if (tx.to.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase()) token = "USDT";
        else if (tx.to.toLowerCase() === USDC_CONTRACT_ADDRESS.toLowerCase()) token = "USDC";
      }
    }

    const txData = {
      txHash: txHash.toLowerCase(),
      from: tx.from,
      to: tx.to,
      amount,
      token,
      blockNumber: receipt.blockNumber,
      gasFee,
      timestamp: new Date(block.timestamp * 1000).toLocaleString()
    };

    await Transaction.create(txData);
    return res.json(txData);
  } catch (err) {
    console.error("Verification error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Get transactions by address
app.get('/api/transactions/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();
    const txs = await Transaction.find({
      $or: [
        { from: { $regex: new RegExp(`^${addr}$`, 'i') } },
        { to: { $regex: new RegExp(`^${addr}$`, 'i') } }
      ]
    }).sort({ _id: -1 });
    res.send(txs);
  } catch {
    res.status(500).send({ error: 'Error fetching transactions' });
  }
});

app.listen(5000, () => {
  console.log("✅ Server running on port 5000");
});
