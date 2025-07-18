import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

function Appln() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [wallet, setWallet] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [revealPassword, setRevealPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [existingUsername, setExistingUsername] = useState('');
  const [bnbAmount, setBnbAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [balance, setBalance] = useState(null);

  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");

  useEffect(() => {
    if (wallet?.address) {
      updateBalance(wallet.address);
    }
  }, [wallet]);

  const updateBalance = async (address) => {
    try {
      const balanceWei = await provider.getBalance(address);
      setBalance(ethers.formatEther(balanceWei));
    } catch (err) {
      console.error("Failed to fetch balance", err);
    }
  };

  const generateWallet = async () => {
    if (!password || !username) {
      alert('Please enter both username and password');
      return;
    }

    const newWallet = ethers.Wallet.createRandom();
    const encryptedJson = await newWallet.encrypt(password);

    const walletData = {
      userId: 'user001',
      username: username,
      address: newWallet.address,
      mnemonic: newWallet.mnemonic.phrase,
      encryptedJson
    };

    try {
      await axios.post('http://localhost:5000/api/wallets', walletData);
      setWallet({ ...newWallet, encryptedJson });
      setShowKeys(false);
      setPrivateKey('');
      updateBalance(newWallet.address);
    } catch (err) {
      alert('Error saving wallet to database');
      console.error(err);
    }
  };

  const revealPrivateKey = async () => {
    if (!wallet || !revealPassword) {
      alert('Enter password to reveal private key');
      return;
    }

    try {
      const decryptedWallet = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      setPrivateKey(decryptedWallet.privateKey);
    } catch (error) {
      alert('Incorrect password');
    }
  };

  const findWalletByUsername = async () => {
    if (!existingUsername) {
      alert('Enter a username to search');
      return;
    }

    try {
      const res = await axios.get(`http://localhost:5000/api/wallets/${existingUsername}`);
      const found = res.data;
      setWallet({
        address: found.address,
        mnemonic: { phrase: found.mnemonic },
        encryptedJson: found.encryptedJson
      });
      setUsername(found.username);
      setShowKeys(true);
      setPrivateKey('');
      updateBalance(found.address);
    } catch (err) {
      alert('Wallet not found for this username');
    }
  };

const sendBNB = async () => {
  if (!wallet || !recipientAddress || !bnbAmount || !revealPassword) {
    alert("Please fill all fields: password, recipient address, and amount.");
    return;
  }

  try {
    const senderWallet = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
    const connectedWallet = senderWallet.connect(provider);

    const senderAddress = await connectedWallet.getAddress();
    const balance = await provider.getBalance(senderAddress);

    // Manually define gas values since getGasPrice() is deprecated in ethers v6
    const gasPrice = ethers.parseUnits("10", "gwei"); // 10 gwei
    const gasLimit = 21000n; // base for transfer
    const gasFee = gasPrice * gasLimit;

    const amountInWei = ethers.parseEther(bnbAmount);

    if (balance < (amountInWei + gasFee)) {
      alert("Not enough BNB to cover amount + gas fees.");
      return;
    }

    const tx = await connectedWallet.sendTransaction({
      to: recipientAddress,
      value: amountInWei,
      gasLimit,
      gasPrice
    });

    await tx.wait();

    alert("✅ BNB sent successfully!");
    updateBalance(senderAddress);
  } catch (error) {
    console.error("Send BNB error:", error);
    alert("❌ Failed to send BNB. Check console for details.");
  }
};


  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>MetaMask</h1>
      <p>Enter a password to secure your wallet:</p>

      <p><strong>Create New Wallet</strong></p>
      <input
        type="text"
        placeholder="Set new username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={inputStyle}
      /><br />
      <input
        type="password"
        placeholder="Set password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
      /><br /><br />
      <button onClick={generateWallet} style={btnStyle}>Generate Wallet</button>
      <button onClick={() => setShowKeys(true)} style={btnStyle}>Show Keys</button>

      <br /><br />
      <p><strong>OR</strong></p>
      <p><strong>Access Existing Wallet</strong></p>
      <input
        type="text"
        placeholder="Enter existing username"
        value={existingUsername}
        onChange={(e) => setExistingUsername(e.target.value)}
        style={inputStyle}
      /><br />
      <button onClick={findWalletByUsername} style={btnStyle}>Find Wallet by Username</button>

      {showKeys && wallet && (
        <div style={{ backgroundColor: '#f1f1f1', padding: '20px', marginTop: '30px', display: 'inline-block', textAlign: 'left', borderRadius: '10px' }}>
          <p><strong>Username:</strong> {username}</p>
          <p><strong>Mnemonic:</strong> {wallet.mnemonic.phrase}</p>
          <p><strong>Address:</strong> {wallet.address}</p>
          {balance !== null && <p><strong>Balance:</strong> {balance} BNB</p>}

          <p>Enter password to reveal private key:</p>
          <input
            type="password"
            placeholder="Password"
            value={revealPassword}
            onChange={(e) => setRevealPassword(e.target.value)}
            style={{ padding: '8px', width: '100%', fontSize: '14px', marginBottom: '10px' }}
          /><br />
          <button onClick={revealPrivateKey} style={btnStyle}>Reveal Private Key</button>
          {privateKey && <p><strong>Private Key:</strong> {privateKey}</p>}

          <hr />
          <h3>Send BNB to Wallet UI</h3>
          <input
            type="text"
            placeholder="Recipient's Public Address"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            style={inputStyle}
          /><br />
          <input
            type="text"
            placeholder="Amount in BNB"
            value={bnbAmount}
            onChange={(e) => setBnbAmount(e.target.value)}
            style={inputStyle}
          /><br />
          <button onClick={sendBNB} style={btnStyle}>Send BNB</button>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  backgroundColor: '#4267B2',
  color: 'white',
  padding: '10px 20px',
  margin: '5px',
  fontSize: '16px',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer'
};

const inputStyle = {
  padding: '10px',
  width: '300px',
  fontSize: '16px',
  marginBottom: '10px'
};

export default Appln;
