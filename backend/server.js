const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb+srv://edric:wined@cluster0.49d4fas.mongodb.net/metamask', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Wallet Schema
const walletSchema = new mongoose.Schema({
  userId: String,
  username: String,
  address: String,
  mnemonic: String,
  encryptedJson: String
});

const Wallet = mongoose.model('Wallet', walletSchema);

// POST: Save wallet
app.post('/api/wallets', async (req, res) => {
  try {
    const wallet = new Wallet(req.body);
    await wallet.save();
    res.status(201).json({ message: 'Wallet saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: All wallets
app.get('/api/wallets', async (req, res) => {
  const wallets = await Wallet.find();
  res.json(wallets);
});

// ✅ NEW: GET wallet by username
app.get('/api/wallets/:username', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ username: req.params.username });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(5000, () => console.log('Server started on http://localhost:5000'));
