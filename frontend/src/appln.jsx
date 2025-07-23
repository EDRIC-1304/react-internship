// Appln.jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import QRCode from 'react-qr-code';
import './appln.css'; // Import the component-specific stylesheet

const USDT_CONTRACT_ADDRESS = '0x787A697324dbA4AB965C58CD33c13ff5eeA6295F';
const USDC_CONTRACT_ADDRESS = '0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1';
const ABI = ["function balanceOf(address) view returns (uint256)", "function transfer(address to, uint amount) returns (bool)"];

function Appln() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [existingUsername, setExistingUsername] = useState('');
  const [wallet, setWallet] = useState(null);
  const [revealPassword, setRevealPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState('BNB');
  const [bnb, setBNB] = useState('0');
  const [usdt, setUSDT] = useState('0');
  const [usdc, setUSDC] = useState('0');
  const [view, setView] = useState('send');
  const [verifyHash, setVerifyHash] = useState('');
  const [verifiedTx, setVerifiedTx] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [popup, setPopup] = useState('');
  const [ledger, setLedger] = useState([]);
  const [disableSend, setDisableSend] = useState(false);
  const [disableVerify, setDisableVerify] = useState(false);
  const [sending, setSending] = useState(false);

  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");

  useEffect(() => {
    if (wallet?.address) updateBalances(wallet.address);
  }, [wallet]);

  const showPopup = (msg) => {
    setPopup(msg);
    setTimeout(() => {
      setPopup('');
      setSending(false);
      setDisableSend(false);
    }, 3000);
  };

  const updateBalances = async (address) => {
    const b = await provider.getBalance(address);
    setBNB(ethers.formatEther(b));

    const usdtC = new ethers.Contract(USDT_CONTRACT_ADDRESS, ABI, provider);
    const usdtB = await usdtC.balanceOf(address);
    setUSDT(ethers.formatUnits(usdtB, 18));

    const usdcC = new ethers.Contract(USDC_CONTRACT_ADDRESS, ABI, provider);
    const usdcB = await usdcC.balanceOf(address);
    setUSDC(ethers.formatUnits(usdcB, 18));
  };
  
  // --- All your other functions (generateWallet, findWalletByUsername, etc.) remain the same ---
  const generateWallet = async () => {
    if (!username || !password) return showPopup("Set username and password");
    const newWallet = ethers.Wallet.createRandom();
    const encryptedJson = await newWallet.encrypt(password);
    const payload = {
      userId: 'user001',
      username,
      address: newWallet.address,
      mnemonic: newWallet.mnemonic.phrase,
      encryptedJson
    };
    try {
      await axios.post("http://localhost:5000/api/wallets", payload);
      setWallet({ ...newWallet, encryptedJson });
      showPopup("✅ Wallet created");
    } catch {
      showPopup("❌ Error creating wallet");
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
      updateBalances(found.address);
      showPopup("✅ Wallet found");
    } catch {
      showPopup("❌ Wallet not found");
    }
  };

  const revealPrivateKey = async () => {
    if (!wallet || !revealPassword) return showPopup("Enter password");
    try {
      const dec = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      setPrivateKey(dec.privateKey);
    } catch {
      showPopup("❌ Wrong password");
    }
  };

  const sendToken = async () => {
    if (!wallet || !revealPassword || !recipientAddress || !amount) return showPopup("❌ Fill all fields");
    setDisableSend(true);
    setSending(true);
    try {
      const dec = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      const connected = dec.connect(provider);
      let tx;

      if (selectedToken === "BNB") {
        tx = await connected.sendTransaction({
          to: recipientAddress,
          value: ethers.parseEther(amount),
          gasLimit: 21000n,
          gasPrice: ethers.parseUnits("10", "gwei")
        });
      } else {
        const contract = new ethers.Contract(
          selectedToken === "USDT" ? USDT_CONTRACT_ADDRESS : USDC_CONTRACT_ADDRESS,
          ABI,
          connected
        );
        tx = await contract.transfer(recipientAddress, ethers.parseUnits(amount, 18));
      }

      await tx.wait();
      setTxHash(tx.hash);
      updateBalances(await connected.getAddress());
      showPopup("✅ Transaction Sent");
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to send");
    }
  };

  const verifyTransaction = async () => {
    if (!verifyHash) return showPopup("Enter hash");
    setDisableVerify(true);
    try {
      const res = await axios.post("http://localhost:5000/api/verify-tx", {
        txHash: verifyHash
      });
      if (res.data && res.data.txHash) {
        setVerifiedTx(res.data);
        showPopup("✅ Verified");
        fetchLedger();
      } else {
        setVerifiedTx(null);
        showPopup("❌ Invalid Hash");
      }
    } catch {
      setVerifiedTx(null);
      showPopup("❌ Invalid Hash");
    }
    setTimeout(() => setDisableVerify(false), 3000);
  };

  const fetchLedger = async () => {
    if (!wallet?.address) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/transactions/${wallet.address}`);
      setLedger(res.data);
    } catch {
      setLedger([]);
    }
  };


  return (
    <div className="appln-container">
      <h1 className="appln-header">React Wallet</h1>

      {/* Wallet Creation/Finding Section */}
      <div className="appln-card">
        <h2 className="appln-card-header">Manage Your Wallet</h2>
        <div className="input-group">
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="appln-input" />
          <input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} className="appln-input" />
          <button className="appln-button" onClick={generateWallet}>Generate Wallet</button>
        </div>
        <div className="input-group">
          <input placeholder="Existing Username" value={existingUsername} onChange={(e) => setExistingUsername(e.target.value)} className="appln-input" />
          <button className="appln-button" onClick={findWalletByUsername}>Find Wallet</button>
        </div>
      </div>

      {/* Wallet Info */}
      {wallet && (
        <div className="appln-card">
          <div className="wallet-info">
            <p><strong>Address:</strong> {wallet.address}</p>
            <p><strong>Balances:</strong> {bnb} BNB | {usdt} USDT | {usdc} USDC</p>
            <p><strong>Mnemonic:</strong> {wallet.mnemonic?.phrase}</p>
          </div>
          <div className="input-group">
            <input type="password" placeholder="Enter Password to Reveal Private Key" value={revealPassword} onChange={(e) => setRevealPassword(e.target.value)} className="appln-input" />
            <button className="appln-button" onClick={revealPrivateKey}>Reveal PK</button>
          </div>
          {privateKey && <p className="private-key"><strong>Private Key:</strong> {privateKey}</p>}
          <div className="view-buttons">
            <button className="appln-button" onClick={() => setView('send')}>Send</button>
            <button className="appln-button" onClick={() => setView('receive')}>Receive</button>
            <button className="appln-button" onClick={() => { setView('ledger'); fetchLedger(); }}>Ledger</button>
          </div>
        </div>
      )}

      {/* Send View */}
      {view === 'send' && wallet && (
        <div className="appln-card">
          <h3 className="appln-card-header">Send Tokens</h3>
          <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} className="appln-input">
            <option value="BNB">BNB</option>
            <option value="USDT">USDT</option>
            <option value="USDC">USDC</option>
          </select>
          <input placeholder="Recipient Address" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} className="appln-input" />
          <input placeholder="Amount to Send" value={amount} onChange={(e) => setAmount(e.target.value)} className="appln-input" />
          <button onClick={sendToken} className="appln-button" disabled={disableSend || sending}>
            {sending ? "Sending..." : "Send Transaction"}
          </button>

          {txHash && (
            <div className="tx-details">
              <p><strong>Hash:</strong> {txHash}</p>
              <button onClick={() => { navigator.clipboard.writeText(txHash); showPopup("📋 Hash Copied") }} className="appln-button-small">Copy Hash</button>
              <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="appln-link">View on BscScan</a>
            </div>
          )}
          
          <hr className="separator" />

          <h4 className="appln-card-header">Verify Transaction</h4>
          <input placeholder="Enter Tx Hash to Verify" value={verifyHash} onChange={(e) => setVerifyHash(e.target.value)} className="appln-input" />
          <button className="appln-button" onClick={verifyTransaction} disabled={disableVerify}>Verify</button>

          {verifiedTx && (
            <div className="verified-tx-card">
              <p><strong>Status:</strong> ✅ Verified</p>
              <p><strong>From:</strong> {verifiedTx.from}</p>
              <p><strong>To:</strong> {verifiedTx.to}</p>
              <p><strong>Amount:</strong> {verifiedTx.amount} {verifiedTx.token}</p>
              <p><strong>Block ID:</strong> {verifiedTx.blockNumber}</p>
              <p><strong>Gas Fee:</strong> {verifiedTx.gasFee} BNB</p>
            </div>
          )}
        </div>
      )}

      {/* Receive View */}
      {view === 'receive' && wallet && (
        <div className="appln-card receive-card">
          <h3 className="appln-card-header">Receive Funds</h3>
          <div className="qr-code-bg">
            <QRCode value={wallet.address} size={160} bgColor="#ffffff" fgColor="#000000" />
          </div>
          <p><strong>Your Wallet Address:</strong></p>
          <code className="wallet-address-code">{wallet.address}</code>
          <button className="appln-button" onClick={() => { navigator.clipboard.writeText(wallet.address); showPopup("📋 Address Copied") }}>
            Copy Address
          </button>
        </div>
      )}

      {/* Transaction Ledger */}
      {view === 'ledger' && wallet && (
        <div className="appln-card">
          <h3 className="appln-card-header">Transaction Ledger</h3>
          <div className="ledger-list">
            {ledger.length === 0 ? <p>No transactions found for this address.</p> : ledger.map((tx, i) => (
              <div key={i} className="ledger-item">
                <p><strong>From:</strong> {tx.from}</p>
                <p><strong>To:</strong> {tx.to}</p>
                <p><strong>Amount:</strong> {tx.amount} {tx.token}</p>
                <p><strong>Gas Fee:</strong> {tx.gasFee} BNB</p>
                <p><strong>Time:</strong> {tx.timestamp}</p>
                <a href={`https://testnet.bscscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="appln-link">View on BscScan</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popup */}
      {popup && (
        <div className="appln-popup">{popup}</div>
      )}
    </div>
  );
}

export default Appln;