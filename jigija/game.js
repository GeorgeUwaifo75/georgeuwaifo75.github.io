class WordJigiJaga {
    constructor() {
        this.score = 0;
        this.level = 1;
        this.attempts = 1;
        this.timeLeft = 60;
        this.timer = null;
        this.gameActive = false;
        this.currentWord = '';
        this.currentLetters = [];
        this.correctLetters = [];
        this.circles = [];
        this.cycleInterval = null;
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.walletConnected = false;
        this.walletBalance = 0;
        this.connector = null;
        this.wallet = null;
        this.isDemoMode = false; // Set to false for real TON connection
        this.tonConnectLoaded = false;
        this.activeCircles = [];
        
        // Your dedicated TON wallet address for receiving payments
        this.YOUR_WALLET_ADDRESS = 'UQB8IVBFuiPlBBqvtIYfv-rfmn4Zh6d-NnDS6wbh1DTysPBX';
        
        // Words database
        this.words = {
            1: ['CAT', 'DOG', 'FISH', 'BIRD', 'SUN'],
            2: ['ELEPHANT', 'GIRAFFE', 'DOLPHIN', 'PANDA', 'TIGER'],
            3: ['BUTTERFLY', 'KANGAROO', 'ALLIGATOR', 'RHINOCEROS', 'HIPPOPOTAMUS']
        };
        
        this.colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#F9A826', '#6C5B7B', '#F08A5D'];
        
        this.init();
    }
    
    init() {
        // Event listeners
        document.getElementById('connect-wallet').addEventListener('click', () => this.connectWallet());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('play-again').addEventListener('click', () => this.resetGame());
        document.getElementById('exit-game').addEventListener('click', () => this.exitGame());
        document.getElementById('next-level').addEventListener('click', () => this.nextLevel());
        document.getElementById('play-again-final').addEventListener('click', () => this.resetGame());
        
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        
        // Set canvas dimensions
        this.canvas.width = 700;
        this.canvas.height = 350;
        
        // Check if TON Connect is loaded
        this.checkTonConnect();
        
        // Load initial state
        this.showScreen('start-screen');
    }
    
    checkTonConnect() {
        // Check if TON Connect library is available
        if (typeof window.TonConnect !== 'undefined') {
            console.log('TON Connect library loaded');
            this.tonConnectLoaded = true;
            this.initializeTonConnect();
        } else {
            console.log('TON Connect library not loaded, waiting...');
            // Wait for library to load
            setTimeout(() => this.checkTonConnect(), 1000);
        }
    }
    
    async initializeTonConnect() {
        try {
            // Create manifest URL - ensure it's accessible
            const manifestUrl = 'https://georgeuwaifo75.github.io/jigija/tonconnect-manifest.json';
            
            // Initialize connector
            this.connector = new window.TonConnect.Connector({
                manifestUrl: manifestUrl
            });
            
            console.log('TON Connect initialized successfully');
            
            // Check for existing connection
            if (this.connector.connected) {
                this.wallet = this.connector.wallet;
                this.walletConnected = true;
                this.walletBalance = 10; // You'd get actual balance from wallet
                this.updateWalletUI();
                this.showNotification('Wallet reconnected!', 'success');
            }
            
            // Subscribe to connection changes
            this.connector.onStatusChange((wallet) => {
                if (wallet) {
                    this.wallet = wallet;
                    this.walletConnected = true;
                    this.updateWalletUI();
                    this.showNotification('Wallet connected successfully!', 'success');
                } else {
                    this.walletConnected = false;
                    this.updateWalletUI();
                }
            });
            
        } catch (error) {
            console.error('TON Connect initialization failed:', error);
            this.showNotification('Failed to initialize TON Connect. Switching to demo mode.', 'error');
            this.isDemoMode = true;
            this.updateWalletUI();
        }
    }
    
    async connectWallet() {
        const connectButton = document.getElementById('connect-wallet');
        connectButton.disabled = true;
        connectButton.innerHTML = '<span class="btn-icon">⏳</span> Connecting...';
        
        try {
            if (this.isDemoMode) {
                // Demo mode connection
                setTimeout(() => {
                    this.walletConnected = true;
                    this.walletBalance = 10;
                    this.updateWalletUI();
                    this.showNotification('Demo mode activated!', 'success');
                    connectButton.disabled = false;
                }, 1000);
                return;
            }
            
            // Check if connector exists
            if (!this.connector) {
                await this.initializeTonConnect();
            }
            
            // Get available wallets
            const wallets = await this.connector.getWallets();
            console.log('Available wallets:', wallets);
            
            if (!wallets || wallets.length === 0) {
                throw new Error('No wallets available');
            }
            
            // Filter for popular wallets (Tonkeeper, etc.)
            const popularWallets = wallets.filter(w => 
                w.name.includes('Tonkeeper') || 
                w.name.includes('Tonhub') || 
                w.name.includes('OpenMask')
            );
            
            const walletToUse = popularWallets.length > 0 ? popularWallets[0] : wallets[0];
            
            // Create connection link
            const link = this.connector.connect(walletToUse.bridgeUrl);
            
            // Open in new tab or show QR code
            if (window.Telegram && window.Telegram.WebApp) {
                // If in Telegram, use Telegram's openLink
                window.Telegram.WebApp.openLink(link);
            } else {
                // Open in new tab
                window.open(link, '_blank');
            }
            
            // Show waiting message
            this.showNotification('Please check your wallet app to complete connection', 'info');
            
        } catch (error) {
            console.error('Connection error:', error);
            this.showNotification('Connection failed: ' + error.message, 'error');
            
            // Offer demo mode as fallback
            if (confirm('Connection failed. Would you like to try demo mode?')) {
                this.isDemoMode = true;
                this.walletConnected = true;
                this.walletBalance = 10;
                this.updateWalletUI();
                this.showNotification('Demo mode activated!', 'success');
            }
        } finally {
            connectButton.disabled = false;
            if (!this.walletConnected) {
                connectButton.innerHTML = '<span class="btn-icon">🔌</span> Connect Wallet';
            }
        }
    }
    
    async sendPayment() {
        if (!this.walletConnected) {
            throw new Error('Wallet not connected');
        }
        
        const amount = '0.05'; // TON amount
        
        try {
            if (this.isDemoMode) {
                // Demo mode payment
                console.log(`[DEMO] Payment of ${amount} TON to ${this.YOUR_WALLET_ADDRESS}`);
                
                if (this.walletBalance >= parseFloat(amount)) {
                    this.walletBalance -= parseFloat(amount);
                    this.updateWalletUI();
                    this.showNotification(`[DEMO] Payment of ${amount} TON simulated!`, 'success');
                    return true;
                } else {
                    throw new Error('Insufficient balance');
                }
            }
            
            // Real TON payment
            if (!this.connector || !this.connector.connected) {
                throw new Error('Wallet not properly connected');
            }
            
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [
                    {
                        address: this.YOUR_WALLET_ADDRESS,
                        amount: (parseFloat(amount) * 1e9).toString() // Convert to nanoTON
                    }
                ]
            };
            
            const result = await this.connector.sendTransaction(transaction);
            console.log('Transaction result:', result);
            
            this.showNotification(`Payment of ${amount} TON sent successfully!`, 'success');
            return true;
            
        } catch (error) {
            console.error('Payment failed:', error);
            throw error;
        }
    }
    
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.notification');
        existing.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <span class="notification-icon">${icons[type] || 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
    
    updateWalletUI() {
        const balanceElement = document.getElementById('wallet-balance');
        const connectButton = document.getElementById('connect-wallet');
        
        if (this.walletConnected) {
            balanceElement.textContent = `${this.walletBalance.toFixed(2)} TON`;
            
            if (this.isDemoMode) {
                connectButton.innerHTML = '<span class="btn-icon">🎮</span> Demo Mode';
                connectButton.style.background = '#f39c12';
                connectButton.disabled = true;
            } else {
                // Get wallet address short form
                const shortAddress = this.wallet ? 
                    this.wallet.account.address.slice(0, 6) + '...' + 
                    this.wallet.account.address.slice(-4) : 'Connected';
                
                connectButton.innerHTML = `<span class="btn-icon">✅</span> ${shortAddress}`;
                connectButton.style.background = '#27ae60';
                connectButton.disabled = true;
            }
        } else {
            balanceElement.textContent = '0.00 TON';
            connectButton.innerHTML = '<span class="btn-icon">🔌</span> Connect Wallet';
            connectButton.disabled = false;
            connectButton.style.background = '#0088cc';
        }
    }
    
    async startGame() {
        if (!this.walletConnected) {
            this.showNotification('Please connect your TON wallet first!', 'error');
            return;
        }
        
        const startButton = document.getElementById('start-game');
        const originalText = startButton.innerHTML;
        startButton.disabled = true;
        startButton.innerHTML = '<span class="btn-icon">⏳</span> Processing...';
        
        try {
            this.showNotification('Processing payment...', 'info');
            await this.sendPayment();
            
            // Start the game
            this.resetGame();
            this.showScreen('game-screen');
            this.startLevel();
            
        } catch (error) {
            this.showNotification('Payment failed: ' + error.message, 'error');
        } finally {
            startButton.disabled = false;
            startButton.innerHTML = originalText;
        }
    }
    
    // Game methods (keep all the game methods from previous version)
    resetGame() {
        this.score = 0;
        this.level = 1;
        this.attempts = 1;
        
        this.clearAllCircles();
        this.drawCircles();
        
        if (this.cycleInterval) {
            clearInterval(this.cycleInterval);
            this.cycleInterval = null;
        }
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        this.updateScore();
        this.updateLevelIndicator();
        this.showScreen('game-screen');
        this.startLevel();
    }
    
    exitGame() {
        this.showScreen('start-screen');
        this.stopGame();
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    startLevel() {
        this.timeLeft = 60;
        this.correctLetters = [];
        this.gameActive = true;
        this.updateTimer();
        this.startTimer();
        this.updateLevelIndicator();
        
        const wordsForLevel = this.words[this.level];
        this.currentWord = wordsForLevel[Math.floor(Math.random() * wordsForLevel.length)];
        this.currentLetters = this.currentWord.split('');
        
        document.getElementById('target-word').textContent = this.currentWord;
        document.getElementById('current-progress').textContent = '';
        
        setTimeout(() => {
            document.getElementById('target-word').textContent = '';
        }, 5000);
        
        this.startCycles();
    }
    
    startTimer() {
        if (this.timer) clearInterval(this.timer);
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimer();
            
            if (this.timeLeft <= 0) {
                this.endLevel(false);
            }
        }, 1000);
    }
    
    updateTimer() {
        document.getElementById('timer').textContent = this.timeLeft;
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('attempts').textContent = this.attempts;
        
        const finalScoreElement = document.getElementById('final-score');
        if (finalScoreElement) {
            finalScoreElement.textContent = this.score;
        }
        
        const totalScoreElement = document.getElementById('total-score');
        if (totalScoreElement) {
            totalScoreElement.textContent = this.score;
        }
    }
    
    updateLevelIndicator() {
        document.querySelectorAll('.level-dot').forEach(dot => {
            dot.classList.remove('active', 'completed');
            
            const dotLevel = parseInt(dot.dataset.level);
            if (dotLevel === this.level) {
                dot.classList.add('active');
            } else if (dotLevel < this.level) {
                dot.classList.add('completed');
            }
        });
        
        const levelNames = ['Easy Peasy', 'Getting Tougher', 'Expert Mode'];
        document.getElementById('level-name').textContent = levelNames[this.level - 1];
    }
    
    startCycles() {
        if (this.cycleInterval) clearInterval(this.cycleInterval);
        
        const cycleTime = this.getCycleTime();
        this.generateCircles();
        
        this.cycleInterval = setInterval(() => {
            this.generateCircles();
        }, cycleTime * 1000);
    }
    
    getCycleTime() {
        switch(this.level) {
            case 1: return 3;
            case 2: return 2;
            case 3: return 1;
            default: return 3;
        }
    }
    
    generateCircles() {
        if (!this.gameActive) return;
        
        this.clearAllCircles();
        
        const circleCount = this.getRandomCircleCount();
        const lettersPool = this.generateLettersPool(circleCount);
        
        this.circles = [];
        for (let i = 0; i < circleCount; i++) {
            const circle = this.createRandomCircle(lettersPool[i]);
            this.circles.push(circle);
        }
        
        this.drawCircles();
        
        setTimeout(() => {
            this.clearAllCircles();
            this.drawCircles();
        }, 1500);
    }
    
    getRandomCircleCount() {
        const minCircles = this.level === 1 ? 1 : (this.level === 2 ? 2 : 3);
        const maxCircles = this.level === 1 ? 4 : (this.level === 2 ? 6 : 8);
        return Math.floor(Math.random() * (maxCircles - minCircles + 1)) + minCircles;
    }
    
    generateLettersPool(circleCount) {
        const lettersPool = [...this.currentLetters];
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        while (lettersPool.length < circleCount) {
            const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
            lettersPool.push(randomLetter);
        }
        
        return this.shuffleArray(lettersPool);
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    createRandomCircle(letter) {
        const padding = 50;
        const minX = padding;
        const maxX = this.canvas.width - padding;
        const minY = padding;
        const maxY = this.canvas.height - padding;
        
        let x, y;
        let attempts = 0;
        const maxAttempts = 50;
        
        do {
            x = Math.random() * (maxX - minX) + minX;
            y = Math.random() * (maxY - minY) + minY;
            attempts++;
            
            if (attempts > maxAttempts) break;
            
        } while (this.isOverlapping(x, y, 40));
        
        return {
            x: x,
            y: y,
            radius: 35,
            letter: letter,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            id: Date.now() + Math.random()
        };
    }
    
    isOverlapping(x, y, minDistance) {
        for (let circle of this.circles) {
            const distance = Math.sqrt(Math.pow(x - circle.x, 2) + Math.pow(y - circle.y, 2));
            if (distance < minDistance * 2) {
                return true;
            }
        }
        return false;
    }
    
    clearAllCircles() {
        this.circles = [];
    }
    
    drawCircles() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBackground();
        
        this.circles.forEach(circle => {
            this.ctx.shadowColor = circle.color;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;
            
            this.ctx.beginPath();
            this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            
            const gradient = this.ctx.createRadialGradient(
                circle.x - 10, circle.y - 10, 5,
                circle.x, circle.y, circle.radius
            );
            gradient.addColorStop(0, circle.color);
            gradient.addColorStop(1, this.darkenColor(circle.color, 30));
            
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
            
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
            
            this.ctx.beginPath();
            this.ctx.arc(circle.x, circle.y, circle.radius - 2, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 5;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;
            
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(circle.letter, circle.x, circle.y);
            
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        });
    }
    
    drawBackground() {
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.strokeStyle = '#e0e0e0';
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.strokeStyle = '#e0e0e0';
            this.ctx.stroke();
        }
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 0 ? 0 : R) * 0x10000 + (G < 0 ? 0 : G) * 0x100 + (B < 0 ? 0 : B)).toString(16).slice(1);
    }
    
    handleCanvasClick(e) {
        if (!this.gameActive) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        let clickedCircle = null;
        for (let i = this.circles.length - 1; i >= 0; i--) {
            const circle = this.circles[i];
            const distance = Math.sqrt(
                Math.pow(mouseX - circle.x, 2) + Math.pow(mouseY - circle.y, 2)
            );
            
            if (distance <= circle.radius) {
                clickedCircle = circle;
                break;
            }
        }
        
        if (clickedCircle) {
            this.handleCircleClick(clickedCircle);
            this.vibrate();
            
            this.circles = this.circles.filter(c => c.id !== clickedCircle.id);
            this.drawCircles();
        }
    }
    
    handleCircleClick(circle) {
        const expectedLetter = this.currentLetters[this.correctLetters.length];
        
        if (circle.letter === expectedLetter) {
            this.playBeep();
            this.correctLetters.push(circle.letter);
            this.score += 10;
            this.updateScore();
            
            document.getElementById('current-progress').textContent = 
                this.correctLetters.join('');
            
            if (this.correctLetters.length === this.currentLetters.length) {
                this.endLevel(true);
            }
        } else {
            this.wrongLetter();
        }
    }
    
    playBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.log('Audio not supported');
        }
    }
    
    vibrate() {
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    
    wrongLetter() {
        this.attempts++;
        document.getElementById('attempts').textContent = this.attempts;
        
        if (this.attempts >= 3) {
            this.gameOver();
        }
    }
    
    endLevel(success) {
        clearInterval(this.timer);
        clearInterval(this.cycleInterval);
        this.gameActive = false;
        
        if (success) {
            const accuracy = (this.correctLetters.length / this.currentLetters.length) * 100;
            
            const levelScoreElement = document.getElementById('level-score');
            const levelAccuracyElement = document.getElementById('level-accuracy');
            
            if (levelScoreElement) {
                levelScoreElement.textContent = this.score;
            }
            if (levelAccuracyElement) {
                levelAccuracyElement.textContent = Math.round(accuracy) + '%';
            }
            
            if (accuracy === 100) {
                this.showCongratulations();
            } else if (accuracy >= 80) {
                this.showLevelComplete('Excellent! Great job!', true);
            } else if (accuracy >= 50) {
                this.showLevelComplete('Good effort! Keep it up!', false);
            } else {
                this.showTryAgain();
            }
        } else {
            this.showTryAgain();
        }
    }
    
    showCongratulations() {
        const totalScoreElement = document.getElementById('total-score');
        if (totalScoreElement) {
            totalScoreElement.textContent = this.score;
        }
        this.showScreen('congratulations-screen');
        this.createBalloons('balloons-falling');
    }
    
    showLevelComplete(message, withBalloons) {
        const messageElement = document.getElementById('level-complete-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        this.showScreen('level-complete-screen');
        
        if (withBalloons) {
            this.createBalloons('balloons-container');
        }
    }
    
    showTryAgain() {
        if (this.attempts >= 3) {
            this.gameOver();
        } else {
            this.showNotification('You\'ve got to try harder!', 'error');
            setTimeout(() => {
                this.startLevel();
            }, 2000);
        }
    }
    
    gameOver() {
        this.showScreen('game-over-screen');
        const finalMessageElement = document.getElementById('final-message');
        if (finalMessageElement) {
            finalMessageElement.textContent = `Final Score: ${this.score}`;
        }
    }
    
    nextLevel() {
        if (this.level < 3) {
            this.level++;
            this.attempts = 1;
            
            this.clearAllCircles();
            this.drawCircles();
            
            if (this.cycleInterval) {
                clearInterval(this.cycleInterval);
                this.cycleInterval = null;
            }
            
            this.startLevel();
            this.showScreen('game-screen');
        } else {
            this.showCongratulations();
        }
    }
    
    createBalloons(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 0; i < 20; i++) {
            const balloon = document.createElement('div');
            balloon.className = 'balloon';
            balloon.style.left = Math.random() * 100 + '%';
            balloon.style.animationDelay = Math.random() * 2 + 's';
            balloon.style.backgroundColor = this.colors[Math.floor(Math.random() * this.colors.length)];
            container.appendChild(balloon);
        }
    }
    
    stopGame() {
        clearInterval(this.timer);
        clearInterval(this.cycleInterval);
        this.gameActive = false;
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    // Load TON Connect library if not present
    if (typeof window.TonConnect === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@tonconnect/sdk@2.1.0/dist/tonconnect-sdk.min.js';
        script.onload = () => {
            console.log('TON Connect SDK loaded dynamically');
            new WordJigiJaga();
        };
        script.onerror = () => {
            console.error('Failed to load TON Connect SDK');
            new WordJigiJaga(); // Will use demo mode
        };
        document.head.appendChild(script);
    } else {
        new WordJigiJaga();
    }
});
