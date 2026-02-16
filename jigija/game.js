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
        this.isDemoMode = false; // Set to false for production with real TON Connect
        
        // Your dedicated TON wallet address for receiving payments
        this.YOUR_WALLET_ADDRESS = 'UQB8IVBFuiPlBBqvtIYfv-rfmn4Zh6d-NnDS6wbh1DTysPBX'; // Replace with your actual TON wallet address
        
        // Words database
        this.words = {
            1: ['CAT', 'DOG', 'FISH', 'BIRD', 'SUN'],
            2: ['ELEPHANT', 'GIRAFFE', 'DOLPHIN', 'PANDA', 'TIGER'],
            3: ['BUTTERFLY', 'KANGAROO', 'ALLIGATOR', 'RHINOCEROS', 'HIPPOPOTAMUS']
        };
        
        this.colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
        
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
        
        // Initialize TON Connect (only if not in demo mode)
        if (!this.isDemoMode) {
            this.initializeTonConnect();
        } else {
            console.log('Running in demo mode - TON Connect disabled');
            // In demo mode, we'll just update the UI to show it's ready
            this.updateWalletUI();
        }
        
        // Load initial state
        this.showScreen('start-screen');
    }
    
    async initializeTonConnect() {
        try {
            // Check if TonConnect is available
            if (typeof TonConnect === 'undefined') {
                console.error('TON Connect library not loaded');
                this.showNotification('TON Connect library not loaded. Using demo mode.', 'info');
                this.isDemoMode = true;
                return;
            }
            
            // Initialize TON Connect with your project configuration
            this.connector = new TonConnect.Connector({
                manifestUrl: 'https://georgeuwaifo75.github.io/jigija/tonconnect-manifest.json'
            });
            
            // Subscribe to connection changes
            this.connector.onStatusChange((wallet) => {
                if (wallet) {
                    this.wallet = wallet;
                    this.walletConnected = true;
                    // Get actual balance if available, otherwise use mock
                    this.walletBalance = 10; // You'd get this from the wallet info
                    this.updateWalletUI();
                    this.showNotification('Wallet connected successfully!', 'success');
                } else {
                    this.walletConnected = false;
                    this.updateWalletUI();
                }
            });
            
            // Restore connection if exists
            if (this.connector.restoreConnection()) {
                console.log('Restored previous connection');
            }
            
        } catch (error) {
            console.error('TON Connect initialization failed:', error);
            this.showNotification('TON Connect initialization failed. Using demo mode.', 'info');
            this.isDemoMode = true;
        }
    }
    
    async connectWallet() {
        try {
            if (this.isDemoMode) {
                // Demo mode: simple confirmation
                if (confirm('Connect to TON Wallet? (Demo Mode)')) {
                    this.walletConnected = true;
                    this.walletBalance = 10; // Mock balance
                    this.updateWalletUI();
                    this.showNotification('Wallet connected successfully! (Demo Mode)', 'success');
                }
                return;
            }
            
            // Real TON Connect implementation
            if (!this.connector) {
                await this.initializeTonConnect();
            }
            
            // Get available wallets
            const walletsList = await this.connector.getWallets();
            
            if (walletsList && walletsList.length > 0) {
                // You might want to show a modal with wallet options here
                // For now, we'll use the first available wallet
                await this.connector.connect(walletsList[0].bridgeUrl);
            } else {
                throw new Error('No wallets available');
            }
            
        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.showNotification('Failed to connect wallet. Using demo mode.', 'error');
            
            // Fallback to demo mode
            this.isDemoMode = true;
            if (confirm('Switch to Demo Mode? You can play without real TON payments.')) {
                this.walletConnected = true;
                this.walletBalance = 10;
                this.updateWalletUI();
                this.showNotification('Demo Mode activated!', 'info');
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
                // Demo mode: simulate payment
                console.log(`[DEMO] Simulating payment of ${amount} TON to ${this.YOUR_WALLET_ADDRESS}`);
                
                if (this.walletBalance >= parseFloat(amount)) {
                    this.walletBalance -= parseFloat(amount);
                    this.updateWalletUI();
                    this.showNotification(`[DEMO] Payment of ${amount} TON simulated!`, 'success');
                    return true;
                } else {
                    throw new Error('Insufficient balance');
                }
            } else {
                // Real TON Connect transaction
                const transaction = {
                    validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes from now
                    messages: [
                        {
                            address: this.YOUR_WALLET_ADDRESS,
                            amount: (parseFloat(amount) * 1e9).toString() // Convert TON to nanoTON
                        }
                    ]
                };
                
                const result = await this.connector.sendTransaction(transaction);
                console.log('Transaction sent:', result);
                
                // Update balance (you'd typically query this from the wallet)
                // For now, we'll just show success
                this.showNotification(`Payment of ${amount} TON sent successfully!`, 'success');
                
                return true;
            }
            
        } catch (error) {
            console.error('Payment failed:', error);
            throw error;
        }
    }
    
    showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'info') icon = 'ℹ️';
        
        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    updateWalletUI() {
        const balanceElement = document.getElementById('wallet-balance');
        const connectButton = document.getElementById('connect-wallet');
        
        if (this.walletConnected) {
            balanceElement.textContent = `${this.walletBalance.toFixed(2)} TON`;
            if (this.isDemoMode) {
                connectButton.innerHTML = '<span class="btn-icon">🎮</span> Demo Mode';
                connectButton.style.background = '#f39c12';
            } else {
                connectButton.innerHTML = '<span class="btn-icon">✅</span> Wallet Connected';
                connectButton.style.background = '#27ae60';
            }
            connectButton.disabled = true;
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
        
        try {
            // Show payment processing
            this.showNotification('Processing payment...', 'info');
            
            // Send payment to your wallet
            await this.sendPayment();
            
            // Start the game after successful payment
            this.resetGame();
            this.showScreen('game-screen');
            this.startLevel();
            
        } catch (error) {
            this.showNotification('Payment failed: ' + error.message, 'error');
        }
    }
    
    resetGame() {
        this.score = 0;
        this.level = 1;
        this.attempts = 1;
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
        // Reset level state
        this.timeLeft = 60;
        this.correctLetters = [];
        this.gameActive = true;
        this.updateTimer();
        this.startTimer();
        this.updateLevelIndicator();
        
        // Get word for current level
        const wordsForLevel = this.words[this.level];
        this.currentWord = wordsForLevel[Math.floor(Math.random() * wordsForLevel.length)];
        this.currentLetters = this.currentWord.split('');
        
        // Display target word
        document.getElementById('target-word').textContent = this.currentWord;
        document.getElementById('current-progress').textContent = '';
        
        // Hide target word after 5 seconds
        setTimeout(() => {
            document.getElementById('target-word').textContent = '';
        }, 5000);
        
        // Start circle cycles
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
        
        // Update final score if on game over screen
        const finalScoreElement = document.getElementById('final-score');
        if (finalScoreElement) {
            finalScoreElement.textContent = this.score;
        }
        
        // Update total score if on congratulations screen
        const totalScoreElement = document.getElementById('total-score');
        if (totalScoreElement) {
            totalScoreElement.textContent = this.score;
        }
    }
    
    updateLevelIndicator() {
        // Update level dots
        document.querySelectorAll('.level-dot').forEach(dot => {
            dot.classList.remove('active', 'completed');
            
            const dotLevel = parseInt(dot.dataset.level);
            if (dotLevel === this.level) {
                dot.classList.add('active');
            } else if (dotLevel < this.level) {
                dot.classList.add('completed');
            }
        });
        
        // Update level name
        const levelNames = ['Easy Peasy', 'Getting Tougher', 'Expert Mode'];
        document.getElementById('level-name').textContent = levelNames[this.level - 1];
    }
    
    startCycles() {
        if (this.cycleInterval) clearInterval(this.cycleInterval);
        
        const cycleTime = this.getCycleTime();
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
        // Clear old circles
        this.circles = [];
        
        // Determine number of circles based on level
        const minCircles = this.level === 1 ? 1 : (this.level === 2 ? 2 : 3);
        const maxCircles = this.level === 1 ? 3 : (this.level === 2 ? 5 : 7);
        const numCircles = Math.floor(Math.random() * (maxCircles - minCircles + 1)) + minCircles;
        
        // Generate letters pool (must include all letters from current word + random letters)
        const lettersPool = [...this.currentLetters];
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        while (lettersPool.length < numCircles * 2) {
            lettersPool.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
        }
        
        // Shuffle pool
        for (let i = lettersPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lettersPool[i], lettersPool[j]] = [lettersPool[j], lettersPool[i]];
        }
        
        // Create circles
        for (let i = 0; i < numCircles; i++) {
            const letter = lettersPool[i];
            const color = this.colors[Math.floor(Math.random() * this.colors.length)];
            
            this.circles.push({
                x: Math.random() * (this.canvas.width - 80) + 40,
                y: Math.random() * (this.canvas.height - 80) + 40,
                radius: 35,
                letter: letter,
                color: color
            });
        }
        
        this.drawCircles();
        
        // Schedule disappearance
        setTimeout(() => {
            this.circles = [];
            this.drawCircles();
        }, 1500);
    }
    
    drawCircles() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.circles.forEach(circle => {
            // Draw circle with glow effect
            this.ctx.shadowColor = circle.color;
            this.ctx.shadowBlur = 15;
            
            // Draw circle
            this.ctx.beginPath();
            this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = circle.color;
            this.ctx.fill();
            
            // Reset shadow for stroke
            this.ctx.shadowBlur = 0;
            
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Draw letter
            this.ctx.font = 'bold 28px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 5;
            this.ctx.fillText(circle.letter, circle.x, circle.y);
            
            // Reset shadow
            this.ctx.shadowBlur = 0;
        });
    }
    
    handleCanvasClick(e) {
        if (!this.gameActive) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        // Check if clicked on any circle
        for (let i = 0; i < this.circles.length; i++) {
            const circle = this.circles[i];
            const distance = Math.sqrt(
                Math.pow(mouseX - circle.x, 2) + Math.pow(mouseY - circle.y, 2)
            );
            
            if (distance <= circle.radius) {
                this.handleCircleClick(circle);
                this.vibrate();
                break;
            }
        }
    }
    
    handleCircleClick(circle) {
        const expectedLetter = this.currentLetters[this.correctLetters.length];
        
        if (circle.letter === expectedLetter) {
            // Correct letter
            this.playBeep();
            this.correctLetters.push(circle.letter);
            this.score += 10;
            this.updateScore();
            
            // Update progress display
            document.getElementById('current-progress').textContent = 
                this.correctLetters.join('');
            
            // Check if word is complete
            if (this.correctLetters.length === this.currentLetters.length) {
                this.endLevel(true);
            }
        } else {
            // Wrong letter
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
            
            // Update level stats
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
    // Check if TON Connect library is loaded
    if (typeof TonConnect === 'undefined') {
        console.warn('TON Connect library not loaded. Running in demo mode.');
    }
    
    new WordJigiJaga();
});
