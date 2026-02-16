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
        this.activeCircles = []; // Track active circles with their disappearance timers
        
        // Your dedicated TON wallet address for receiving payments
        this.YOUR_WALLET_ADDRESS = 'UQB8IVBFuiPlBBqvtIYfv-rfmn4Zh6d-NnDS6wbh1DTysPBX'; // Replace with your actual TON wallet address
        
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
        
        // Set canvas dimensions with proper size for circle generation
        this.canvas.width = 700;
        this.canvas.height = 350;
        
        // Initialize TON Connect (only if not in demo mode)
        if (!this.isDemoMode) {
            this.initializeTonConnect();
        } else {
            console.log('Running in demo mode - TON Connect disabled');
            this.updateWalletUI();
        }
        
        // Load initial state
        this.showScreen('start-screen');
    }
    
    // ... (keep all the TON Connect and wallet methods from previous version) ...
    
    // Update the generateCircles method for true random placement
    generateCircles() {
        if (!this.gameActive) return;
        
        // Clear any existing circles that haven't been removed
        this.clearAllCircles();
        
        // Determine number of circles based on level
        const circleCount = this.getRandomCircleCount();
        
        // Generate letters pool (must include all letters from current word + random letters)
        const lettersPool = this.generateLettersPool(circleCount);
        
        // Create new circles with truly random positions
        this.circles = [];
        for (let i = 0; i < circleCount; i++) {
            const circle = this.createRandomCircle(lettersPool[i]);
            this.circles.push(circle);
        }
        
        // Draw the circles
        this.drawCircles();
        
        // Schedule circles to disappear after 1.5 seconds
        setTimeout(() => {
            this.clearAllCircles();
            this.drawCircles(); // Redraw empty canvas
        }, 1500);
    }
    
    getRandomCircleCount() {
        // Returns random number of circles based on level
        const minCircles = this.level === 1 ? 1 : (this.level === 2 ? 2 : 3);
        const maxCircles = this.level === 1 ? 4 : (this.level === 2 ? 6 : 8);
        return Math.floor(Math.random() * (maxCircles - minCircles + 1)) + minCircles;
    }
    
    generateLettersPool(circleCount) {
        // Start with all letters from current word
        const lettersPool = [...this.currentLetters];
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        // Add random letters until we have enough for all circles
        while (lettersPool.length < circleCount) {
            const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
            lettersPool.push(randomLetter);
        }
        
        // Shuffle the pool for random distribution
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
        // Add padding to ensure circles aren't cut off at edges
        const padding = 50;
        const minX = padding;
        const maxX = this.canvas.width - padding;
        const minY = padding;
        const maxY = this.canvas.height - padding;
        
        // Generate random position
        let x, y;
        let attempts = 0;
        const maxAttempts = 50;
        
        // Try to avoid overlapping circles (optional, makes game more playable)
        do {
            x = Math.random() * (maxX - minX) + minX;
            y = Math.random() * (maxY - minY) + minY;
            attempts++;
            
            // If we can't find a non-overlapping position after many attempts, just use random
            if (attempts > maxAttempts) break;
            
        } while (this.isOverlapping(x, y, 40)); // Check if position overlaps with existing circles
        
        return {
            x: x,
            y: y,
            radius: 35,
            letter: letter,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            id: Date.now() + Math.random() // Unique ID for tracking
        };
    }
    
    isOverlapping(x, y, minDistance) {
        // Check if new circle overlaps with existing ones
        for (let circle of this.circles) {
            const distance = Math.sqrt(Math.pow(x - circle.x, 2) + Math.pow(y - circle.y, 2));
            if (distance < minDistance * 2) {
                return true; // Overlaps
            }
        }
        return false; // No overlap
    }
    
    clearAllCircles() {
        this.circles = [];
    }
    
    drawCircles() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background grid pattern (optional, makes canvas more interesting)
        this.drawBackground();
        
        this.circles.forEach(circle => {
            // Draw circle with glow effect
            this.ctx.shadowColor = circle.color;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;
            
            // Draw main circle
            this.ctx.beginPath();
            this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            
            // Create gradient for more visual appeal
            const gradient = this.ctx.createRadialGradient(
                circle.x - 10, circle.y - 10, 5,
                circle.x, circle.y, circle.radius
            );
            gradient.addColorStop(0, circle.color);
            gradient.addColorStop(1, this.darkenColor(circle.color, 30));
            
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
            
            // Reset shadow for stroke
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
            
            // Add white inner glow
            this.ctx.beginPath();
            this.ctx.arc(circle.x, circle.y, circle.radius - 2, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw outer border
            this.ctx.beginPath();
            this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Draw letter with shadow for better readability
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 5;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;
            
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(circle.letter, circle.x, circle.y);
            
            // Reset shadow
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        });
    }
    
    drawBackground() {
        // Draw subtle grid pattern
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 0; x <= this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.strokeStyle = '#e0e0e0';
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.strokeStyle = '#e0e0e0';
            this.ctx.stroke();
        }
    }
    
    darkenColor(color, percent) {
        // Helper function to darken colors for gradient
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 0 ? 0 : R) * 0x10000 + (G < 0 ? 0 : G) * 0x100 + (B < 0 ? 0 : B)).toString(16).slice(1);
    }
    
    // Update startCycles for better timing
    startCycles() {
        if (this.cycleInterval) clearInterval(this.cycleInterval);
        
        const cycleTime = this.getCycleTime();
        
        // Generate first set immediately
        this.generateCircles();
        
        // Then set interval for subsequent sets
        this.cycleInterval = setInterval(() => {
            this.generateCircles();
        }, cycleTime * 1000);
    }
    
    // ... (keep all other methods from previous version) ...
    
    // Update the level transition to ensure smooth circle generation
    nextLevel() {
        if (this.level < 3) {
            this.level++;
            this.attempts = 1;
            
            // Clear any existing circles
            this.clearAllCircles();
            this.drawCircles();
            
            // Stop current cycles
            if (this.cycleInterval) {
                clearInterval(this.cycleInterval);
                this.cycleInterval = null;
            }
            
            // Start new level
            this.startLevel();
            this.showScreen('game-screen');
        } else {
            this.showCongratulations();
        }
    }
    
    // Update handleCanvasClick for better circle detection
    handleCanvasClick(e) {
        if (!this.gameActive) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        // Check if clicked on any circle (iterate in reverse to handle overlapping)
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
            
            // Remove the clicked circle immediately for better feedback
            this.circles = this.circles.filter(c => c.id !== clickedCircle.id);
            this.drawCircles();
        }
    }
    
    // Add method to reset game properly
    resetGame() {
        this.score = 0;
        this.level = 1;
        this.attempts = 1;
        
        // Clear all circles and intervals
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
}

// Initialize game when page loads
window.addEventListener('load', () => {
    if (typeof TonConnect === 'undefined') {
        console.warn('TON Connect library not loaded. Running in demo mode.');
    }
    
    new WordJigiJaga();
});
