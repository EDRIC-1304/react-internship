// Appln.jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import QRCode from 'react-qr-code';

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
    <div style={styles.container}>
      <h1 style={{ color: '#00ffcc' }}>React Wallet</h1>

      {/* Wallet Creation Section */}
      <div>
        <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} />
        <input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />
        <button style={styles.button} onClick={generateWallet}>Generate Wallet</button>
        <input placeholder="Existing Username" value={existingUsername} onChange={(e) => setExistingUsername(e.target.value)} style={styles.input} />
        <button style={styles.button} onClick={findWalletByUsername}>Find Wallet</button>
      </div>

      {/* Wallet Info */}
      {wallet && (
        <div style={styles.card}>
          <p><strong>Address:</strong> {wallet.address}</p>
          <p><strong>BNB:</strong> {bnb} | <strong>USDT:</strong> {usdt} | <strong>USDC:</strong> {usdc}</p>
          <p><strong>Mnemonic:</strong> {wallet.mnemonic?.phrase}</p>
          <input type="password" placeholder="Password to reveal PK" value={revealPassword} onChange={(e) => setRevealPassword(e.target.value)} style={styles.input} />
          <button style={styles.button} onClick={revealPrivateKey}>Reveal PK</button>
          {privateKey && <p><strong>Private Key:</strong> {privateKey}</p>}
          <div style={{ marginTop: '15px' }}>
            <button style={styles.button} onClick={() => setView('send')}>Send</button>
            <button style={styles.button} onClick={() => setView('receive')}>Receive</button>
            <button style={styles.button} onClick={() => { setView('ledger'); fetchLedger(); }}>Transaction Ledger</button>
          </div>
        </div>
      )}

      {/* Send View */}
      {view === 'send' && (
        <div style={styles.card}>
          <h3>Send Tokens</h3>
          <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} style={styles.input}>
            <option value="BNB">BNB</option>
            <option value="USDT">USDT</option>
            <option value="USDC">USDC</option>
          </select>
          <input placeholder="To Address" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} style={styles.input} />
          <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} />
          <button onClick={sendToken} style={styles.button} disabled={disableSend || sending}>
            {sending ? "Sending..." : "Send"}
          </button>

          {txHash && (
            <>
              <p><strong>Hash:</strong> {txHash}</p>
              <button onClick={() => { navigator.clipboard.writeText(txHash); showPopup("📋 Hash Copied") }} style={styles.button}>Copy Hash</button>
              <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00ccff' }}>View on BscScan</a>
            </>
          )}

          <input placeholder="Tx Hash to verify" value={verifyHash} onChange={(e) => setVerifyHash(e.target.value)} style={styles.input} />
          <button style={styles.button} onClick={verifyTransaction} disabled={disableVerify}>Verify</button>

          {verifiedTx && (
            <div style={styles.card}>
              <p><strong>Status:</strong> ✅</p>
              <p><strong>From:</strong> {verifiedTx.from}</p>
              <p><strong>To:</strong> {verifiedTx.to}</p>
              <p><strong>Amount:</strong> {verifiedTx.amount}</p>
              <p><strong>Token:</strong> {verifiedTx.token}</p>
              <p><strong>Block ID:</strong> {verifiedTx.blockNumber}</p>
              <p><strong>Gas Fee:</strong> {verifiedTx.gasFee} BNB</p>
            </div>
          )}
        </div>
      )}

      {/* Receive View */}
      {view === 'receive' && (
        <div style={styles.card}>
          <h3>Receive</h3>
          <QRCode value={wallet?.address || ''} size={160} bgColor="#1f1f1f" fgColor="#00ffcc" />
          <p><strong>Wallet Address:</strong></p>
          <code>{wallet.address}</code><br />
          <button style={styles.button} onClick={() => { navigator.clipboard.writeText(wallet.address); showPopup("📋 Address Copied") }}>
            Copy Address
          </button>
        </div>
      )}

      {/* Transaction Ledger */}
      {view === 'ledger' && (
        <div style={styles.card}>
          <h3>Transaction Ledger</h3>
          {ledger.length === 0 ? <p>No transactions</p> : ledger.map((tx, i) => (
            <div key={i} style={{ border: '1px solid #333', padding: 10, marginBottom: 10 }}>
              <p><strong>From:</strong> {tx.from}</p>
              <p><strong>To:</strong> {tx.to}</p>
              <p><strong>Amount:</strong> {tx.amount}</p>
              <p><strong>Token:</strong> {tx.token}</p>
              <p><strong>Gas Fee:</strong> {tx.gasFee}</p>
              <p><strong>Block ID:</strong> {tx.blockNumber}</p>
              <p><strong>Time:</strong> {tx.timestamp}</p>
              <a href={`https://testnet.bscscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00ccff' }}>View on BscScan</a>
            </div>
          ))}
        </div>
      )}

      {/* Popup */}
      {popup && (
        <div style={styles.popup}>{popup}</div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#111',
    color: 'white',
    padding: '30px',
    minHeight: '100vh',
    textAlign: 'center'
  },
  input: {
    padding: '10px',
    margin: '8px',
    fontSize: '16px',
    backgroundColor: '#1f1f1f',
    color: 'white',
    border: '1px solid #333',
    borderRadius: '5px'
  },
  button: {
    padding: '10px 20px',
    margin: '8px',
    backgroundColor: '#00cc99',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: '10px',
    padding: '20px',
    marginTop: '20px'
  },
  popup: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#333',
    color: '#00ffcc',
    padding: '10px 20px',
    borderRadius: '8px',
    zIndex: 999
  }
};

export default Appln;
