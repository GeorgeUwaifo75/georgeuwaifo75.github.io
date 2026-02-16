// === TELEGRAM WEB APP INIT ===
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// === TON CONNECT ===
let tonConnectUI;
let isConnected = false;
const RECEIVING_WALLET = "YOUR_RECEIVING_WALLET_ADDRESS_HERE"; // ← CHANGE THIS

function initTonConnect() {
  tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: location.origin + "/tonconnect-manifest.json",
    buttonRootId: "wallet-status"
  });

  tonConnectUI.onStatusChange(wallet => {
    isConnected = !!wallet;
    document.getElementById("wallet-status").innerHTML = wallet 
      ? `Connected: ${wallet.account.address.slice(0,6)}...${wallet.account.address.slice(-4)}` 
      : "Wallet not connected";
  });
}

// === GAME VARIABLES ===
let currentLevel = 1;
let attempts = 0;
let score = 0;
let timer = 60;
let timerInterval = null;
let spawnInterval = null;
let currentWord = "";
let currentIndex = 0;
let activeCircles = [];
let levelWords = {
  1: ["APPLE","HOUSE","BIRD","CAKE","DANCE","LIGHT","MUSIC","RIVER"],
  2: ["BANANA","CHOCOLATE","ELEPHANT","GIRAFFE","HORIZON","JUNGLE","KANGAROO","MOUNTAIN"],
  3: ["ADVENTURE","BEAUTIFUL","CELEBRATE","DISCOVER","EXCELLENT","FANTASTIC","GIGANTIC","HAPPINESS"]
};

const gameArea = document.getElementById("game-area");
const wordDisplay = document.getElementById("word-display");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const levelEl = document.getElementById("level");
const progressFill = document.getElementById("progress-fill");

// === UTILS ===
function randomLetter() {
  return String.fromCharCode(65 + Math.floor(Math.random()*26));
}

function createCircle(letter) {
  const circle = document.createElement("div");
  circle.className = "circle";
  circle.textContent = letter;
  
  const hue = Math.random()*360;
  circle.style.background = `hsl(${hue}, 80%, 55%)`;
  
  // random position (avoid edges)
  const maxX = gameArea.clientWidth - 80;
  const maxY = gameArea.clientHeight - 80;
  circle.style.left = Math.random() * maxX + "px";
  circle.style.top = Math.random() * maxY + "px";
  
  circle.onclick = () => handleTap(circle, letter);
  
  gameArea.appendChild(circle);
  activeCircles.push(circle);
  
  // auto disappear after 2.8 seconds
  setTimeout(() => {
    if (circle.parentNode) {
      circle.remove();
      activeCircles = activeCircles.filter(c => c !== circle);
    }
  }, 2800);
}

function handleTap(circle, letter) {
  if (letter === currentWord[currentIndex]) {
    // correct
    currentIndex++;
    score += 10;
    scoreEl.textContent = score;
    
    // feedback
    if (navigator.vibrate) navigator.vibrate(40);
    playBeep(800, 80);
    
    circle.style.transform = "scale(1.6)";
    circle.style.opacity = "0";
    setTimeout(() => {
      if (circle.parentNode) circle.remove();
      activeCircles = activeCircles.filter(c => c !== circle);
    }, 200);
    
    updateProgress();
    
    // level complete?
    if (currentIndex === currentWord.length) {
      endLevel(true);
    }
  } else {
    // wrong – visual feedback
    circle.style.transform = "rotate(20deg)";
    setTimeout(() => circle.style.transform = "rotate(-20deg)", 80);
    setTimeout(() => circle.style.transform = "", 200);
  }
}

function playBeep(freq, duration) {
  const audio = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audio.createOscillator();
  osc.frequency.value = freq;
  osc.connect(audio.destination);
  osc.start();
  setTimeout(() => osc.stop(), duration);
}

function updateProgress() {
  const percent = Math.round((currentIndex / currentWord.length) * 100);
  progressFill.style.width = percent + "%";
}

// === SPAWN LOGIC ===
function startSpawning() {
  const rates = {1: 3000, 2: 2000, 3: 1000};
  const minMax = {1: [1,3], 2: [2,5], 3: [3,7]};
  
  spawnInterval = setInterval(() => {
    const [min, max] = minMax[currentLevel];
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    
    for (let i = 0; i < count; i++) {
      let letter;
      if (Math.random() < 0.65) {
        letter = currentWord[Math.floor(Math.random() * currentWord.length)];
      } else {
        letter = randomLetter();
      }
      createCircle(letter);
    }
  }, rates[currentLevel]);
}

// === LEVEL ===
function startLevel() {
  currentWord = levelWords[currentLevel][Math.floor(Math.random() * levelWords[currentLevel].length)];
  currentIndex = 0;
  attempts = 0;
  activeCircles.forEach(c => c.remove());
  activeCircles = [];
  
  levelEl.textContent = currentLevel;
  wordDisplay.textContent = currentWord;
  progressFill.style.width = "0%";
  
  // show word for 5 seconds
  document.getElementById("game-screen").classList.add("active");
  document.getElementById("start-screen").classList.remove("active");
  
  setTimeout(() => {
    wordDisplay.textContent = "GO!";
    setTimeout(() => {
      wordDisplay.textContent = "";
      timer = 60;
      timerEl.textContent = timer;
      timerInterval = setInterval(() => {
        timer--;
        timerEl.textContent = timer;
        if (timer <= 0) endLevel(false);
      }, 1000);
      
      startSpawning();
    }, 800);
  }, 5000);
}

function endLevel(completed) {
  clearInterval(timerInterval);
  clearInterval(spawnInterval);
  
  const percent = Math.round((currentIndex / currentWord.length) * 100);
  
  const resultScreen = document.getElementById("result-screen");
  const msg = document.getElementById("result-message");
  const resScore = document.getElementById("result-score");
  
  document.getElementById("game-screen").classList.remove("active");
  resultScreen.classList.add("active");
  
  if (completed || percent === 100) {
    msg.innerHTML = `<h2 style="color:#00ff9d">PERFECT!</h2>`;
    confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
    document.getElementById("next-btn").style.display = "block";
    document.getElementById("retry-btn").style.display = "none";
  } else if (percent >= 50) {
    msg.innerHTML = `<h2 style="color:#ffd700">Good effort!</h2><p>Keep going!</p>`;
    document.getElementById("next-btn").style.display = "block";
    document.getElementById("retry-btn").style.display = "none";
  } else {
    attempts++;
    msg.innerHTML = `<h2 style="color:#ff5555">You've got to try harder!</h2>`;
    resScore.textContent = `${percent}% correct`;
    document.getElementById("next-btn").style.display = "none";
    document.getElementById("retry-btn").style.display = "block";
    
    if (attempts >= 3) {
      setTimeout(() => showGameOver(), 1800);
      return;
    }
  }
  
  resScore.textContent = `Score this level: ${currentIndex * 10}`;
  
  // next level button
  document.getElementById("next-btn").onclick = () => {
    currentLevel++;
    if (currentLevel > 3) {
      showGameOver(true);
    } else {
      resultScreen.classList.remove("active");
      startLevel();
    }
  };
  
  document.getElementById("retry-btn").onclick = () => {
    resultScreen.classList.remove("active");
    startLevel();
  };
}

function showGameOver(win = false) {
  document.getElementById("result-screen").classList.remove("active");
  const go = document.getElementById("gameover-screen");
  go.classList.add("active");
  document.getElementById("final-score").textContent = score;
  
  if (win) {
    document.querySelector("#gameover-screen h2").textContent = "You Win!";
  }
}

// === PAYMENT & START ===
async function payAndStart() {
  if (!isConnected) {
    try {
      await tonConnectUI.connectWallet();
    } catch(e) {
      alert("Wallet connection cancelled");
      return;
    }
  }
  
  const transaction = {
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [{
      address: RECEIVING_WALLET,
      amount: "50000000"   // 0.05 TON = 50 000 000 nanoTON
    }]
  };
  
  try {
    await tonConnectUI.sendTransaction(transaction);
    // payment successful
    document.getElementById("start-screen").classList.remove("active");
    document.getElementById("intro-screen").classList.add("active");
    
    document.getElementById("begin-btn").onclick = () => {
      document.getElementById("intro-screen").classList.remove("active");
      startLevel();
    };
  } catch(e) {
    alert("Payment failed or cancelled");
  }
}

// === INIT ===
initTonConnect();

document.getElementById("start-btn").onclick = payAndStart;
document.getElementById("play-again-btn").onclick = () => {
  document.getElementById("gameover-screen").classList.remove("active");
  score = 0;
  currentLevel = 1;
  document.getElementById("start-screen").classList.add("active");
};
document.getElementById("exit-btn").onclick = () => tg.close();

// Keyboard support for testing
document.addEventListener("keydown", e => {
  if (e.key === "r" && document.getElementById("gameover-screen").classList.contains("active")) {
    document.getElementById("play-again-btn").click();
  }
});
