// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCCdniT5Bwlr-Ea9uz_2-g4P6gbZJTdxak",
    authDomain: "jdschat-1f695.firebaseapp.com",
    databaseURL: "https://jdschat-1f695-default-rtdb.firebaseio.com",
    projectId: "jdschat-1f695",
    storageBucket: "jdschat-1f695.firebasestorage.app",
    messagingSenderId: "618817840341",
    appId: "1:618817840341:web:edcb55702d7d3f13bc6e5c"
};

// Initialize Firebase
let app;
let database;

try {
    app = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization failed:", error);
    showNotification("Connection failed. Please refresh the page.", 'error');
}

// Predefined users
const validUsers = {
    'admin': 'admin123',
    'ds': 'deepalikesdamascus',
    'hp': 'harshadiscool'
};

// Global variables
let currentUser = null;
let messagesRef = null;
let usersRef = null;
let userPresenceRef = null;
let typingTimeouts = {};

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const chatInterface = document.getElementById('chatInterface');
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const onlineUsers = document.getElementById('onlineUsers');
const userCount = document.getElementById('userCount');
const logoutBtn = document.getElementById('logoutBtn');
const connectionStatus = document.getElementById('connectionStatus');
const typingIndicator = document.getElementById('typingIndicator');

// Utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
    
    // Close on click
    notification.querySelector('.notification-close').onclick = () => {
        notification.remove();
    };
}

function getRandomGradient() {
    const gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
}

// Login functionality
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    
    // Add loading state
    const loginBtn = document.querySelector('.login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    
    btnText.textContent = 'Signing in...';
    loginBtn.disabled = true;
    
    setTimeout(() => {
        if (validUsers[username] && validUsers[username] === password) {
            currentUser = username;
            try {
                initializeChat();
                showChatInterface();
                errorMessage.classList.remove('show');
                showNotification(`Welcome back, ${username}!`, 'success');
            } catch (error) {
                console.error("Error initializing chat:", error);
                showNotification("Failed to connect to chat", 'error');
                btnText.textContent = originalText;
                loginBtn.disabled = false;
            }
        } else {
            errorMessage.classList.add('show');
            btnText.textContent = originalText;
            loginBtn.disabled = false;
            
            // Shake animation
            loginForm.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                loginForm.style.animation = '';
            }, 500);
        }
    }, 1000); // Simulate loading time
});

// Show chat interface with animation
function showChatInterface() {
    loginScreen.style.opacity = '0';
    loginScreen.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        loginScreen.style.display = 'none';
        chatInterface.style.display = 'flex';
        chatInterface.style.opacity = '0';
        
        requestAnimationFrame(() => {
            chatInterface.style.transition = 'opacity 0.6s ease';
            chatInterface.style.opacity = '1';
        });
        
        // Focus on message input
        setTimeout(() => {
            messageInput.focus();
        }, 300);
    }, 300);
}

// Initialize chat
function initializeChat() {
    if (!database) {
        throw new Error("Database not initialized");
    }
    
    messagesRef = database.ref('messages');
    usersRef = database.ref('users');
    userPresenceRef = usersRef.child(currentUser);
    
    // Set user as online
    userPresenceRef.set({
        username: currentUser,
        online: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        gradient: getRandomGradient()
    }).catch((error) => {
        console.error("Error setting user presence:", error);
        showNotification("Connection error", 'error');
    });
    
    // Remove user when they disconnect
    userPresenceRef.onDisconnect().update({
        online: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Listen for messages
    messagesRef.orderByChild('timestamp').limitToLast(50).on('value', function(snapshot) {
        displayMessages(snapshot.val());
    }, function(error) {
        console.error("Error listening to messages:", error);
        showNotification("Error loading messages", 'error');
    });
    
    // Listen for online users
    usersRef.on('value', function(snapshot) {
        updateOnlineUsers(snapshot.val());
    });
    
    // Connection status
    database.ref('.info/connected').on('value', function(snapshot) {
        const statusElement = document.querySelector('.status-indicator span');
        const statusDot = document.querySelector('.status-dot');
        
        if (snapshot.val() === true) {
            statusElement.textContent = 'Connected';
            statusDot.classList.remove('disconnected');
        } else {
            statusElement.textContent = 'Disconnected';
            statusDot.classList.add('disconnected');
        }
    });
}

// Display messages
function displayMessages(messages) {
    // Remove welcome message if it exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    // Clear existing messages (except typing indicator)
    const existingMessages = chatMessages.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    if (messages) {
        const messageArray = Object.entries(messages)
            .map(([key, value]) => ({ ...value, id: key }))
            .sort((a, b) => a.timestamp - b.timestamp);
        
        messageArray.forEach((message, index) => {
            setTimeout(() => {
                createMessageElement(message);
            }, index * 50); // Stagger animation
        });
    }
    
    scrollToBottom();
}

// Create message element
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.username === currentUser ? 'own' : ''}`;
    
    const isOwnMessage = message.username === currentUser;
    
    if (!isOwnMessage) {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.textContent = message.username.charAt(0).toUpperCase();
        avatarDiv.style.background = message.gradient || getRandomGradient();
        messageDiv.appendChild(avatarDiv);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    if (!isOwnMessage) {
        const userDiv = document.createElement('div');
        userDiv.className = 'message-user';
        userDiv.textContent = message.username.charAt(0).toUpperCase() + message.username.slice(1);
        bubbleDiv.appendChild(userDiv);
    }
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message.text;
    bubbleDiv.appendChild(textDiv);
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(message.timestamp);
    bubbleDiv.appendChild(timeDiv);
    
    contentDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(contentDiv);
    
    if (isOwnMessage) {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.textContent = message.username.charAt(0).toUpperCase();
        avatarDiv.style.background = getRandomGradient();
        messageDiv.appendChild(avatarDiv);
    }
    
    chatMessages.appendChild(messageDiv);
}

// Format time
function formatTime(timestamp) {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
    
    if (diffInMinutes < 1) {
        return 'now';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours}h ago`;
    } else {
        return messageTime.toLocaleDateString();
    }
}

// Update online users
function updateOnlineUsers(users) {
    onlineUsers.innerHTML = '';
    let onlineCount = 0;
    
    if (users) {
        Object.values(users).forEach(user => {
            if (user.online) {
                onlineCount++;
                createUserElement(user);
            }
        });
    }
    
    userCount.textContent = onlineCount.toString();
}

// Create user element
function createUserElement(user) {
    const userDiv = document.createElement('div');
    userDiv.className = 'user-bubble';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'user-avatar';
    avatarDiv.textContent = user.username.charAt(0).toUpperCase();
    avatarDiv.style.background = user.gradient || getRandomGradient();
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'user-info';
    
    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'username';
    usernameDiv.textContent = user.username.charAt(0).toUpperCase() + user.username.slice(1);
    
    const statusDiv = document.createElement('div');
    statusDiv.className = 'user-status';
    statusDiv.textContent = 'Active now';
    
    infoDiv.appendChild(usernameDiv);
    infoDiv.appendChild(statusDiv);
    userDiv.appendChild(avatarDiv);
    userDiv.appendChild(infoDiv);
    
    onlineUsers.appendChild(userDiv);
}

// Send message
function sendMessage() {
    const messageText = messageInput.value.trim();
    if (messageText === '' || !messagesRef) return;
    
    const message = {
        username: currentUser,
        text: messageText,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        id: Date.now() + '_' + currentUser,
        gradient: getRandomGradient()
    };
    
    messagesRef.push(message).then(() => {
        messageInput.value = '';
        // Add send animation
        sendBtn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            sendBtn.style.transform = 'scale(1)';
        }, 150);
    }).catch((error) => {
        console.error("Error sending message:", error);
        showNotification("Failed to send message", 'error');
    });
}

// Event listeners
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize message input
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Logout functionality
logoutBtn.addEventListener('click', function() {
    if (userPresenceRef) {
        userPresenceRef.update({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    // Animate logout
    chatInterface.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    chatInterface.style.opacity = '0';
    chatInterface.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        currentUser = null;
        chatInterface.style.display = 'none';
        loginScreen.style.display = 'flex';
        loginScreen.style.opacity = '0';
        loginScreen.style.transform = 'translateY(20px)';
        
        requestAnimationFrame(() => {
            loginScreen.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            loginScreen.style.opacity = '1';
            loginScreen.style.transform = 'translateY(0)';
        });
        
        // Clear form
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        errorMessage.classList.remove('show');
    }, 300);
});

// Scroll to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle window beforeunload
window.addEventListener('beforeunload', function() {
    if (userPresenceRef && currentUser) {
        userPresenceRef.update({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }
});

// Add notification styles dynamically
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 16px 20px;
        color: var(--text-primary);
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
        box-shadow: 0 10px 25px var(--shadow-dark);
    }
    
    .notification.success {
        border-color: var(--accent-green);
        background: rgba(48, 209, 88, 0.1);
    }
    
    .notification.error {
        border-color: var(--danger-red);
        background: rgba(255, 59, 48, 0.1);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;

// Inject notification styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);