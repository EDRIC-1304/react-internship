import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

const USDT_CONTRACT_ADDRESS = '0x787A697324dbA4AB965C58CD33c13ff5eeA6295F';
const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

const USDC_CONTRACT_ADDRESS = '0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1';
const USDC_ABI = [
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
  const [bnbBalance, setBnbBalance] = useState("0");
  const [usdtBalance, setUsdtBalance] = useState("0");
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [selectedToken, setSelectedToken] = useState('BNB');
  const [isSending, setIsSending] = useState(false);
  const [verifyHash, setVerifyHash] = useState('');
  const [verifiedTx, setVerifiedTx] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);

  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");

  useEffect(() => {
    if (wallet?.address) updateBalances(wallet.address);
  }, [wallet, selectedToken]);

  const updateBalances = async (address) => {
    try {
      const balanceWei = await provider.getBalance(address);
      setBnbBalance(ethers.formatEther(balanceWei));

      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);
      const usdtRaw = await usdtContract.balanceOf(address);
      setUsdtBalance(ethers.formatUnits(usdtRaw, 18));

      const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, provider);
      const usdcRaw = await usdcContract.balanceOf(address);
      console.log("USDC raw balance:", usdcRaw.toString());
      setUsdcBalance(ethers.formatUnits(usdcRaw, 18));
    } catch (err) {
      console.error("Balance fetch error:", err);
      setBnbBalance("0");
      setUsdtBalance("0");
      setUsdcBalance("0");
    }
  };

  const generateWallet = async () => {
    if (!username || !password) return alert("Enter username & password");
    const newWallet = ethers.Wallet.createRandom();
    const encryptedJson = await newWallet.encrypt(password);

    const walletData = {
      userId: 'user001',
      username,
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
    } catch {
      alert("❌ Error saving wallet");
    }
  };

  const findWalletByUsername = async () => {
    if (!existingUsername) return alert("Enter a username");
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
      updateBalances(found.address);
    } catch {
      alert("Wallet not found");
    }
  };

  const revealPrivateKey = async () => {
    if (!wallet || !revealPassword) return alert("Enter password");
    try {
      const decrypted = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      setPrivateKey(decrypted.privateKey);
    } catch {
      alert("Incorrect password");
    }
  };

  const sendBNB = async (wallet) => {
    const tx = await wallet.sendTransaction({
      to: recipientAddress,
      value: ethers.parseEther(amount),
      gasLimit: 21000n,
      gasPrice: ethers.parseUnits("10", "gwei")
    });
    await tx.wait();
    setTxHash(tx.hash);
    setCopied(false);
    alert(`✅ BNB sent!\n\nTransaction Hash:\n${tx.hash}`);
  };

  const sendUSDT = async (wallet) => {
    const contract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, wallet);
    const tx = await contract.transfer(recipientAddress, ethers.parseUnits(amount, 18));
    await tx.wait();
    setTxHash(tx.hash);
    setCopied(false);
    alert(`✅ USDT sent!\n\nTransaction Hash:\n${tx.hash}`);
  };

  const sendUSDC = async (wallet) => {
    const contract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, wallet);
    const tx = await contract.transfer(recipientAddress, ethers.parseUnits(amount, 18));
    await tx.wait();
    setTxHash(tx.hash);
    setCopied(false);
    alert(`✅ USDC sent!\n\nTransaction Hash:\n${tx.hash}`);
  };

  const sendToken = async () => {
    if (!wallet || !recipientAddress || !amount || !revealPassword) return alert("Please fill all fields");
    setIsSending(true);
    try {
      const decrypted = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      const connected = decrypted.connect(provider);
      if (selectedToken === "BNB") await sendBNB(connected);
      if (selectedToken === "USDT") await sendUSDT(connected);
      if (selectedToken === "USDC") await sendUSDC(connected);
      updateBalances(await connected.getAddress());
    } catch (err) {
      alert("❌ Failed to send token");
    }
    setIsSending(false);
  };

  const verifyTransaction = async () => {
    if (!verifyHash) return alert("Enter transaction hash");
    try {
      const res = await axios.post("http://localhost:5000/api/verify-tx", { txHash: verifyHash });
      setVerifiedTx(res.data);
    } catch {
      alert("❌ Transaction not verified.");
      setVerifiedTx(null);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={{ color: '#00ffcc' }}>METAMASK WALLET</h1>

      <input placeholder="Set new username" value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} />
      <input type="password" placeholder="Set password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />
      <button onClick={generateWallet} style={styles.button}>Generate Wallet</button>
      <button onClick={() => setShowKeys(true)} style={styles.button}>Show Keys</button>

      <hr style={styles.divider} />
      <input placeholder="Enter existing username" value={existingUsername} onChange={(e) => setExistingUsername(e.target.value)} style={styles.input} />
      <button onClick={findWalletByUsername} style={styles.button}>Find Wallet</button>

      {showKeys && wallet && (
        <div style={styles.card}>
          <p><strong>Username:</strong> {username}</p>
          <p><strong>Mnemonic:</strong> {wallet.mnemonic.phrase}</p>
          <p><strong>Address:</strong> {wallet.address}</p>
          <p><strong>BNB:</strong> {bnbBalance} BNB</p>
          <p><strong>USDT:</strong> {usdtBalance} USDT</p>
          <p><strong>USDC:</strong> {usdcBalance} USDC</p>

          <input type="password" placeholder="Password to reveal private key" value={revealPassword} onChange={(e) => setRevealPassword(e.target.value)} style={styles.input} />
          <button onClick={revealPrivateKey} style={styles.button}>Reveal Private Key</button>
          {privateKey && <p><strong>Private Key:</strong> {privateKey}</p>}

          <h3 style={{ color: '#00ccff' }}>Send Token</h3>
          <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} style={styles.input}>
            <option value="BNB">BNB</option>
            <option value="USDT">USDT</option>
            <option value="USDC">USDC</option>
          </select>
          <input placeholder="Recipient Address" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} style={styles.input} />
          <input placeholder={`Amount in ${selectedToken}`} value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} />
          <button onClick={sendToken} disabled={isSending} style={{ ...styles.button, backgroundColor: isSending ? 'gray' : '#00cc99' }}>
            {isSending ? 'Sending...' : `Send ${selectedToken}`}
          </button>

          {txHash && (
            <div>
              <p><strong>Transaction Hash:</strong></p>
              <code style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '8px', display: 'inline-block' }}>{txHash}</code><br />
              <button style={styles.button} onClick={() => { navigator.clipboard.writeText(txHash); setCopied(true); }}>
                📋 {copied ? 'Copied!' : 'Copy Hash'}
              </button>
            </div>
          )}
        </div>
      )}

      <hr style={styles.divider} />

      <h3 style={{ color: '#00ff99' }}>🔍 Verify Transaction</h3>
      <input placeholder="Enter transaction hash" value={verifyHash} onChange={(e) => setVerifyHash(e.target.value)} style={styles.input} />
      <button onClick={verifyTransaction} style={styles.button}>Verify</button>

      {verifiedTx && (
        <div style={styles.card}>
          <p><strong>Status:</strong> ✅ Verified</p>
          <p><strong>From:</strong> {verifiedTx.from}</p>
          <p><strong>To:</strong> {verifiedTx.to}</p>
          <p><strong>Amount:</strong> {verifiedTx.amount} {verifiedTx.token}</p>
          <p><strong>Block ID:</strong> {verifiedTx.blockNumber}</p>
          <p><strong>Gas Fee:</strong> {verifiedTx.gasFee} BNB</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#121212',
    color: 'white',
    minHeight: '100vh',
    padding: '30px',
    textAlign: 'center'
  },
  input: {
    padding: '10px',
    width: '300px',
    margin: '10px',
    fontSize: '16px',
    backgroundColor: '#1f1f1f',
    color: 'white',
    border: '1px solid #444',
    borderRadius: '6px'
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#00cc99',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    margin: '5px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  card: {
    backgroundColor: '#1e1e1e',
    padding: '20px',
    marginTop: '20px',
    borderRadius: '10px',
    display: 'inline-block',
    textAlign: 'left'
  },
  divider: {
    borderColor: '#333',
    margin: '40px 0'
  }
};

export default Appln;
