/* eslint-env browser, node */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import QRCode from 'react-qr-code';
import './appln.css';

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
  const [txHash, setTxHash] = useState('');
  const [popup, setPopup] = useState('');
  const [ledger, setLedger] = useState([]);
  const [disableSend, setDisableSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingTxs, setPendingTxs] = useState([]);
  const [cancellingTxHash, setCancellingTxHash] = useState(null);

  const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545");

  const showPopup = (msg) => {
    setPopup(msg);
    setTimeout(() => {
      setPopup('');
    }, 3500);
  };

  const updateBalances = useCallback(async (address) => {
    try {
      const b = await provider.getBalance(address);
      setBNB(ethers.formatEther(b));
      const usdtC = new ethers.Contract(USDT_CONTRACT_ADDRESS, ABI, provider);
      const usdtB = await usdtC.balanceOf(address);
      setUSDT(ethers.formatUnits(usdtB, 18));
      const usdcC = new ethers.Contract(USDC_CONTRACT_ADDRESS, ABI, provider);
      const usdcB = await usdcC.balanceOf(address);
      setUSDC(ethers.formatUnits(usdcB, 18));
    } catch (error) {
      console.error("Failed to update balances:", error);
      showPopup("❌ Could not fetch balances.");
    }
  }, []); 

  useEffect(() => {
    if (wallet?.address) {
      updateBalances(wallet.address);
    }
  }, [wallet, updateBalances]);

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
    if (!wallet || !revealPassword || !recipientAddress || !amount) {
      return showPopup("❌ Please fill all fields to send.");
    }
    setDisableSend(true);
    setSending(true);
    let tx;
    try {
      const dec = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      const connected = dec.connect(provider);

      if (selectedToken === "BNB") {
        tx = await connected.sendTransaction({ to: recipientAddress, value: ethers.parseEther(amount) });
      } else {
        const contractAddress = selectedToken === "USDT" ? USDT_CONTRACT_ADDRESS : USDC_CONTRACT_ADDRESS;
        const contract = new ethers.Contract(contractAddress, ABI, connected);
        tx = await contract.transfer(recipientAddress, ethers.parseUnits(amount, 18));
      }

      setTxHash(tx.hash);
      const pendingTxData = { hash: tx.hash, amount, token: selectedToken, to: recipientAddress };
      setPendingTxs(prev => [...prev, pendingTxData]);
      showPopup("⏳ Transaction Submitted! Awaiting confirmation...");

      await tx.wait();

      try {
        await axios.post("http://localhost:5000/api/transactions/record", { txHash: tx.hash });
        showPopup("✅ Transaction Confirmed & Recorded!");
      } catch (error) {
        console.error("Ledger recording failed:", error);
        showPopup("✅ Tx Confirmed, but failed to record in ledger.");
      }

      updateBalances(await connected.getAddress());

    } catch (err) {
      console.error(err);
      showPopup("❌ Transaction Failed or was Rejected.");
    } finally {
      if (tx) {
        setPendingTxs(prev => prev.filter(p => p.hash !== tx.hash));
      }
      setSending(false);
      setDisableSend(false);
    }
  };

  const handleCancelTransaction = async (stuckTxHash) => {
    if (!wallet || !revealPassword) {
      return showPopup("❌ Enter password to sign the cancellation transaction.");
    }

    setCancellingTxHash(stuckTxHash);
    showPopup("🔍 Checking transaction status...");

    try {
      // --- NEW: First, check if the transaction has already been mined ---
      const receipt = await provider.getTransactionReceipt(stuckTxHash);
      if (receipt && receipt.blockNumber) {
        showPopup("✅ Transaction has already been confirmed!");
        // Remove it from the pending list
        setPendingTxs(prev => prev.filter(p => p.hash !== stuckTxHash));
        updateBalances(wallet.address); // Update balances just in case
        return; // Stop the cancellation process
      }

      const decryptedWallet = await ethers.Wallet.fromEncryptedJson(wallet.encryptedJson, revealPassword);
      const connectedWallet = decryptedWallet.connect(provider);

      const stuckTx = await provider.getTransaction(stuckTxHash);
      if (!stuckTx) {
        // This can still happen if the tx was dropped from the mempool
        throw new Error("Transaction not found. It may have been confirmed or dropped.");
      }

      // Increase gas price by 20% to be safe
      const newGasPrice = stuckTx.gasPrice * BigInt(120) / BigInt(100);

      showPopup("Gas price increased. Submitting cancellation...");
      
      const cancelTx = await connectedWallet.sendTransaction({
        to: wallet.address, // Sending to yourself
        value: ethers.parseEther("0"),
        nonce: stuckTx.nonce,
        gasPrice: newGasPrice,
      });

      showPopup("⏳ Submitting cancellation... Awaiting confirmation.");
      await cancelTx.wait();

      setPendingTxs(prev => prev.filter(p => p.hash !== stuckTxHash));
      showPopup(`✅ Original transaction successfully cancelled with new Tx: ${cancelTx.hash}`);

    } catch (err) {
      console.error("Cancellation failed:", err);
      // More specific error message for the user
      if (err.message.includes("not found")) {
        showPopup("❌ Cancellation failed. The transaction was likely already processed.");
        // If it was processed, remove it from the pending list
        setPendingTxs(prev => prev.filter(p => p.hash !== stuckTxHash));
        updateBalances(wallet.address);
      } else {
        showPopup(`❌ Cancellation failed: ${err.message}`);
      }
    } finally {
      setCancellingTxHash(null);
    }
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

      {wallet && (
        <div className="appln-card">
          <div className="wallet-info">
            <p><strong>Address:</strong> {wallet.address}</p>
            <p><strong>Balances:</strong> {bnb} BNB | {usdt} USDT | {usdc} USDC</p>
            <p><strong>Mnemonic:</strong> {wallet.mnemonic?.phrase}</p>
          </div>
          <div className="input-group">
            <input type="password" placeholder="Enter Password for Actions" value={revealPassword} onChange={(e) => setRevealPassword(e.target.value)} className="appln-input" />
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
              <p><strong>Last Tx Hash:</strong> {txHash}</p>
              <button onClick={() => { navigator.clipboard.writeText(txHash); showPopup("📋 Hash Copied") }} className="appln-button-small">Copy Hash</button>
              <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="appln-link">View on BscScan</a>
            </div>
          )}
        </div>
      )}

      {pendingTxs.length > 0 && (
        <div className="appln-card">
          <h3 className="appln-card-header">Pending Transactions</h3>
          <div className="ledger-list">
            {pendingTxs.map(tx => (
              <div key={tx.hash} className="ledger-item pending-item">
                <p><strong>Sending:</strong> {tx.amount} {tx.token} to {tx.to.substring(0, 10)}...</p>
                <div className="pending-details">
                  <div className="spinner"></div>
                  <span>Pending...</span>
                  <a href={`https://testnet.bscscan.com/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="appln-link">
                    View on BscScan
                  </a>
                  <button
                    className="appln-button-cancel"
                    onClick={() => handleCancelTransaction(tx.hash)}
                    disabled={cancellingTxHash === tx.hash}
                  >
                    {cancellingTxHash === tx.hash ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {popup && (
        <div className="appln-popup">{popup}</div>
      )}
    </div>
  );
}

export default Appln;