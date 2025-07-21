import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

// USDT Contract (BEP-20 on BSC Testnet)
const USDT_CONTRACT_ADDRESS = '0x787A697324dbA4AB965C58CD33c13ff5eeA6295F';
const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

function Appln() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [wallet, setWallet] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [revealPassword, setRevealPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [existingUsername, setExistingUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [bnbBalance, setBnbBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);
  const [selectedToken, setSelectedToken] = useState('BNB');

  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");

  useEffect(() => {
    if (wallet?.address) {
      updateBalances(wallet.address);
    }
  }, [wallet, selectedToken]);

  const updateBalances = async (address) => {
  try {
    // Get BNB balance
    const balanceWei = await provider.getBalance(address);
    setBnbBalance(ethers.formatEther(balanceWei));

    // Get USDT balance
    try {
      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);
      const rawBalance = await usdtContract.balanceOf(address);
      const formattedBalance = ethers.formatUnits(rawBalance, 18); // USDT usually uses 18 decimals on BSC testnet
      setUsdtBalance(formattedBalance);
    } catch (usdtError) {
      console.error("Failed to fetch USDT balance:", usdtError);
      setUsdtBalance("0");
    }

  } catch (err) {
    console.error("Failed to fetch balances", err);
    setBnbBalance("0");
    setUsdtBalance("0");
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
      updateBalances(newWallet.address);
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
      updateBalances(found.address);
    } catch (err) {
      alert('Wallet not found for this username');
    }
  };

  const sendBNB = async (connectedWallet) => {
    const senderAddress = await connectedWallet.getAddress();
    const balance = await provider.getBalance(senderAddress);
    const gasPrice = ethers.parseUnits("10", "gwei");
    const gasLimit = 21000n;
    const gasFee = gasPrice * gasLimit;
    const amountInWei = ethers.parseEther(amount);

    if (balance < amountInWei + gasFee) {
      alert("Not enough BNB for amount + gas fees.");
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
  };

  const sendUSDT = async (connectedWallet) => {
    const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, connectedWallet);
    const decimals = 18;
    const tx = await usdtContract.transfer(recipientAddress, ethers.parseUnits(amount, decimals));
    await tx.wait();
    alert("✅ USDT sent successfully!");
  };

  const sendToken = async () => {
    if (!wallet || !recipientAddress || !amount || !revealPassword) {
      alert("Please fill all fields");
      return;
    }

    try {
      const decryptedWallet = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      const connectedWallet = decryptedWallet.connect(provider);

      if (selectedToken === "BNB") {
        await sendBNB(connectedWallet);
      } else {
        await sendUSDT(connectedWallet);
      }

      updateBalances(await connectedWallet.getAddress());
    } catch (error) {
      console.error("Send Token Error:", error);
      alert("❌ Failed to send token");
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>MetaMask</h1>
      <p><strong>Create New Wallet</strong></p>
      <input placeholder="Set new username" value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} /><br />
      <input type="password" placeholder="Set password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} /><br />
      <button onClick={generateWallet} style={btnStyle}>Generate Wallet</button>
      <button onClick={() => setShowKeys(true)} style={btnStyle}>Show Keys</button>

      <p><strong>OR</strong></p>
      <input placeholder="Enter existing username" value={existingUsername} onChange={(e) => setExistingUsername(e.target.value)} style={inputStyle} /><br />
      <button onClick={findWalletByUsername} style={btnStyle}>Find Wallet by Username</button>

      {showKeys && wallet && (
        <div style={cardStyle}>
          <p><strong>Username:</strong> {username}</p>
          <p><strong>Mnemonic:</strong> {wallet.mnemonic.phrase}</p>
          <p><strong>Address:</strong> {wallet.address}</p>
          <p><strong>BNB Balance:</strong> {bnbBalance} BNB</p>
          <p><strong>USDT Balance:</strong> {usdtBalance} USDT</p>

          <input type="password" placeholder="Password to reveal private key" value={revealPassword} onChange={(e) => setRevealPassword(e.target.value)} style={inputStyle} /><br />
          <button onClick={revealPrivateKey} style={btnStyle}>Reveal Private Key</button>
          {privateKey && <p><strong>Private Key:</strong> {privateKey}</p>}

          <hr />
          <h3>Send Token</h3>
          <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} style={inputStyle}>
            <option value="BNB">BNB</option>
            <option value="USDT">USDT</option>
          </select><br />
          <input type="text" placeholder="Recipient Address" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} style={inputStyle} /><br />
          <input type="text" placeholder={`Amount in ${selectedToken}`} value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} /><br />
          <button onClick={sendToken} style={btnStyle}>Send {selectedToken}</button>
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

const cardStyle = {
  backgroundColor: '#f1f1f1',
  padding: '20px',
  marginTop: '30px',
  display: 'inline-block',
  textAlign: 'left',
  borderRadius: '10px'
};

export default Appln;
