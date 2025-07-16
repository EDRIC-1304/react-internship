import React, { useState } from 'react';
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
      setUsername(found.username); // for display
      setShowKeys(true);
      setPrivateKey('');
    } catch (err) {
      alert('Wallet not found for this username');
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
      />
      <br />
      <input
        type="password"
        placeholder="Set password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
      />
      <br /><br />
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
      />
      <br />
      <button onClick={findWalletByUsername} style={btnStyle}>Find Wallet by Username</button>

      {showKeys && wallet && (
        <div style={{
          backgroundColor: '#f1f1f1',
          padding: '20px',
          marginTop: '30px',
          display: 'inline-block',
          textAlign: 'left',
          borderRadius: '10px'
        }}>
          <p><strong>Username:</strong> {username}</p>
          <p><strong>Mnemonic:</strong> {wallet.mnemonic.phrase}</p>
          <p><strong>Address:</strong> {wallet.address}</p>

          <p>Enter password to reveal private key:</p>
          <input
            type="password"
            placeholder="Password"
            value={revealPassword}
            onChange={(e) => setRevealPassword(e.target.value)}
            style={{
              padding: '8px',
              width: '100%',
              fontSize: '14px',
              marginBottom: '10px'
            }}
          />
          <br />
          <button onClick={revealPrivateKey} style={btnStyle}>Reveal Private Key</button>

          {privateKey && (
            <div style={{ marginTop: '10px' }}>
              <p><strong>Private Key:</strong> {privateKey}</p>
            </div>
          )}
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
