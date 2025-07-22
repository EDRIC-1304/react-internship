import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import QRCode from 'react-qr-code';

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
  const [view, setView] = useState('wallet');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [existingUsername, setExistingUsername] = useState('');
  const [wallet, setWallet] = useState(null);
  const [revealPassword, setRevealPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [bnbBalance, setBnbBalance] = useState("0");
  const [usdtBalance, setUsdtBalance] = useState("0");
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [selectedToken, setSelectedToken] = useState("BNB");
  const [txHash, setTxHash] = useState('');
  const [verifyHash, setVerifyHash] = useState('');
  const [verifiedTx, setVerifiedTx] = useState(null);
  const [copied, setCopied] = useState(false);
  const [popup, setPopup] = useState('');
  const [loading, setLoading] = useState(false);

  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");

  const showPopup = (msg) => {
    setPopup(msg);
    setTimeout(() => setPopup(''), 3000);
  };

  useEffect(() => {
    if (wallet?.address) updateBalances(wallet.address);
  }, [wallet]);

  const updateBalances = async (address) => {
    try {
      const bnb = await provider.getBalance(address);
      const usdt = await new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider).balanceOf(address);
      const usdc = await new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, provider).balanceOf(address);
      setBnbBalance(ethers.formatEther(bnb));
      setUsdtBalance(ethers.formatUnits(usdt, 18));
      setUsdcBalance(ethers.formatUnits(usdc, 18));
    } catch (err) {
      setBnbBalance("0"); setUsdtBalance("0"); setUsdcBalance("0");
    }
  };

  const generateWallet = async () => {
    if (!username || !password) return showPopup("Enter username and password");
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
      showPopup("✅ Wallet Generated");
    } catch {
      showPopup("❌ Error saving wallet");
    }
  };

  const findWalletByUsername = async () => {
    if (!existingUsername) return showPopup("Enter username");
    try {
      const res = await axios.get(`http://localhost:5000/api/wallets/${existingUsername}`);
      const found = res.data;
      setWallet({
        address: found.address,
        mnemonic: { phrase: found.mnemonic },
        encryptedJson: found.encryptedJson
      });
      setUsername(found.username);
      updateBalances(found.address);
      showPopup("✅ Wallet Found");
    } catch {
      showPopup("❌ Wallet not found");
    }
  };

  const revealPrivateKey = async () => {
    if (!wallet || !revealPassword) return showPopup("Enter password");
    try {
      const decrypted = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      setPrivateKey(decrypted.privateKey);
      showPopup("🔓 Private Key Revealed");
    } catch {
      showPopup("❌ Incorrect password");
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
    showPopup("✅ BNB sent");
  };

  const sendUSDT = async (wallet) => {
    const contract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, wallet);
    const tx = await contract.transfer(recipientAddress, ethers.parseUnits(amount, 18));
    await tx.wait();
    setTxHash(tx.hash);
    showPopup("✅ USDT sent");
  };

  const sendUSDC = async (wallet) => {
    const contract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, wallet);
    const tx = await contract.transfer(recipientAddress, ethers.parseUnits(amount, 18));
    await tx.wait();
    setTxHash(tx.hash);
    showPopup("✅ USDC sent");
  };

  const sendToken = async () => {
    if (!wallet || !recipientAddress || !amount || !revealPassword)
      return showPopup("Fill all fields");

    setLoading(true);
    try {
      const decrypted = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      const connected = decrypted.connect(provider);
      if (selectedToken === "BNB") await sendBNB(connected);
      if (selectedToken === "USDT") await sendUSDT(connected);
      if (selectedToken === "USDC") await sendUSDC(connected);
      updateBalances(connected.address);
    } catch {
      showPopup("❌ Send failed");
    }
    setLoading(false);
  };

  const verifyTransaction = async () => {
    if (!verifyHash) return showPopup("Enter transaction hash");
    try {
      const res = await axios.post("http://localhost:5000/api/verify-tx", { txHash: verifyHash });
      setVerifiedTx(res.data);
      showPopup("✅ Transaction Verified");
    } catch {
      showPopup("❌ Verification failed");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={{ color: '#00ffcc' }}>Metamask Wallet</h1>
      <div style={{ marginBottom: 20 }}>
        {['wallet', 'send', 'receive', 'verify'].map(tab => (
          <button key={tab} onClick={() => setView(tab)} style={styles.button}>{tab.toUpperCase()}</button>
        ))}
      </div>

      {/* Wallet Tab */}
      {view === 'wallet' && (
        <div>
          <input placeholder="New Username" value={username} onChange={e => setUsername(e.target.value)} style={styles.input} />
          <input type="password" placeholder="Set Password" value={password} onChange={e => setPassword(e.target.value)} style={styles.input} />
          <button onClick={generateWallet} style={styles.button}>Generate Wallet</button>
          <hr style={styles.divider} />
          <input placeholder="Find by Username" value={existingUsername} onChange={e => setExistingUsername(e.target.value)} style={styles.input} />
          <button onClick={findWalletByUsername} style={styles.button}>Find Wallet</button>
          {wallet && (
            <div style={styles.card}>
              <p><strong>Username:</strong> {username}</p>
              <p><strong>Address:</strong> {wallet.address}</p>
              <p><strong>Mnemonic:</strong> {wallet.mnemonic.phrase}</p>
              <p><strong>BNB:</strong> {bnbBalance}</p>
              <p><strong>USDT:</strong> {usdtBalance}</p>
              <p><strong>USDC:</strong> {usdcBalance}</p>
              <input type="password" placeholder="Password to reveal PK" value={revealPassword} onChange={(e) => setRevealPassword(e.target.value)} style={styles.input} />
              <button onClick={revealPrivateKey} style={styles.button}>Reveal Private Key</button>
              {privateKey && <p><strong>Private Key:</strong> {privateKey}</p>}
            </div>
          )}
        </div>
      )}

      {/* Send Tab */}
      {view === 'send' && wallet && (
        <div style={styles.card}>
          <select value={selectedToken} onChange={e => setSelectedToken(e.target.value)} style={styles.input}>
            <option value="BNB">BNB</option>
            <option value="USDT">USDT</option>
            <option value="USDC">USDC</option>
          </select>
          <input placeholder="Recipient Address" value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} style={styles.input} />
          <input placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} style={styles.input} />
          <input type="password" placeholder="Password" value={revealPassword} onChange={e => setRevealPassword(e.target.value)} style={styles.input} />
          <button onClick={sendToken} disabled={loading} style={styles.button}>{loading ? 'Sending...' : 'Send'}</button>
         {txHash && (
  <>
       <p><strong>Tx Hash:</strong> {txHash}</p>
      <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00ffcc' }}>
      🔍 View on BscScan
     </a><br />
       <button style={styles.button} onClick={() => { navigator.clipboard.writeText(txHash); setCopied(true); }}>
        {copied ? 'Copied!' : 'Copy Hash'}
     </button>
  </>
)}

        </div>
      )}

      {/* Receive Tab */}
      {view === 'receive' && wallet && (
        <div style={styles.card}>
          <h3>Receive via QR</h3>
          <QRCode value={wallet.address} size={180} bgColor="#1f1f1f" fgColor="#00ffcc" />
          <p><strong>Wallet Address:</strong></p>
          <code style={{ wordBreak: 'break-all' }}>{wallet.address}</code>
          <br />
          <button onClick={() => { navigator.clipboard.writeText(wallet.address); setCopied(true); }} style={styles.button}>
            {copied ? 'Copied!' : 'Copy Address'}
          </button>
        </div>
      )}

      {/* Verify Tab */}
      {view === 'verify' && (
        <div style={styles.card}>
          <input placeholder="Enter Tx Hash" value={verifyHash} onChange={(e) => setVerifyHash(e.target.value)} style={styles.input} />
          <button onClick={verifyTransaction} style={styles.button}>Verify</button>
          {verifiedTx && (
            <>
              <p><strong>Status:</strong> ✅</p>
              <p><strong>From:</strong> {verifiedTx.from}</p>
              <p><strong>To:</strong> {verifiedTx.to}</p>
              <p><strong>Amount:</strong> {verifiedTx.amount} {verifiedTx.token}</p>
              <p><strong>Block ID:</strong> {verifiedTx.blockNumber}</p>
              <p><strong>Gas Fee:</strong> {verifiedTx.gasFee} BNB</p>
            </>
          )}
        </div>
      )}

      {/* Popup Message */}
      {popup && (
        <div style={styles.popup}>
          {popup}
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
  },
  popup: {
    position: 'fixed',
    top: '40%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#222',
    color: '#00ffcc',
    padding: '20px',
    borderRadius: '10px',
    zIndex: 999
  }
};

export default Appln;
