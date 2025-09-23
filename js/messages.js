const Amplify = window.aws_amplify.Amplify;
const Auth = Amplify.Auth;

// Configure Amplify
aws_amplify.Amplify.configure({
  Auth: {
    region: 'us-east-2',
    userPoolId: 'us-east-2_AxTL9MRLy',
    userPoolWebClientId: '69hs07li090olcre8pg8uji24r',
  }
});

let currentUserId = null;
let currentConversation = null;
let conversations = [];
let refreshInterval = null;

window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      currentUserId = user.attributes.sub;
      await loadConversations();
    })
    .catch(() => {
      window.location.replace("login.html");
    });

  const signOutBtn = document.getElementById("signOut");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        await Auth.signOut();
        window.location.replace("login.html");
      } catch (err) {
        alert("Sign out error: " + err.message);
      }
    });
  }
  
  // Mobile hamburger menu
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');
  const overlay = document.getElementById('mobileOverlay');
  
  function toggleMobileMenu() {
    nav.classList.toggle('open');
    overlay.classList.toggle('show');
  }
  
  function closeMobileMenu() {
    nav.classList.remove('open');
    overlay.classList.remove('show');
  }
  
  if (hamburger && nav && overlay) {
    hamburger.addEventListener('click', toggleMobileMenu);
    overlay.addEventListener('click', closeMobileMenu);
    
    // Close menu when clicking nav links
    const navLinks = nav.querySelectorAll('.page');
    navLinks.forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });
  }
};

async function loadConversations() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    conversations = await response.json();
    displayConversations();
    
    // Select first conversation if available
    if (conversations.length > 0) {
      selectConversation(0);
    }
    
    // Start auto-refresh for new messages
    startAutoRefresh();
    
  } catch (error) {
    console.error('Error loading conversations:', error);
    document.getElementById('conversationList').innerHTML = '<p>No conversations yet. Get matched to start messaging!</p>';
  }
}

function startAutoRefresh() {
  // Clear any existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // Refresh conversations every 5 seconds
  refreshInterval = setInterval(async () => {
    const oldConversationId = currentConversation?.otherUserId;
    await loadConversations();
    
    // Reselect the same conversation if it still exists
    if (oldConversationId) {
      const conversationIndex = conversations.findIndex(c => c.otherUserId === oldConversationId);
      if (conversationIndex !== -1) {
        selectConversation(conversationIndex);
      }
    }
  }, 5000);
}

// Stop auto-refresh when page is hidden
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  } else {
    startAutoRefresh();
  }
});

function displayConversations() {
  const conversationList = document.getElementById('conversationList');
  
  if (conversations.length === 0) {
    conversationList.innerHTML = '<p>No conversations yet. Get matched to start messaging!</p>';
    return;
  }
  
  conversationList.innerHTML = '';
  
  conversations.forEach((conversation, index) => {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const lastMessageText = lastMessage ? lastMessage.message : 'No messages yet';
    const lastMessageTime = lastMessage ? formatTime(lastMessage.timestamp) : '';
    
    const conversationDiv = document.createElement('div');
    conversationDiv.className = 'conversation-item';
    conversationDiv.onclick = () => selectConversation(index);
    
    const initials = conversation.otherUserName.split(' ').map(n => n[0]).join('').toUpperCase();
    
    conversationDiv.innerHTML = `
      <div class="conversation-avatar">${initials}</div>
      <div class="conversation-info">
        <div class="conversation-name">${conversation.otherUserName}</div>
        <div class="conversation-preview">${lastMessageText}</div>
        <div class="conversation-time">${lastMessageTime}</div>
      </div>
    `;
    
    conversationList.appendChild(conversationDiv);
  });
}

function selectConversation(index) {
  // Remove active class from all conversations
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Add active class to selected conversation
  document.querySelectorAll('.conversation-item')[index].classList.add('active');
  
  currentConversation = conversations[index];
  displayMessages();
  updateChatHeader();
}

function displayMessages() {
  const messagesContent = document.getElementById('messagesContent');
  messagesContent.innerHTML = '';
  
  if (!currentConversation || currentConversation.messages.length === 0) {
    messagesContent.innerHTML = '<p>No messages yet. Start the conversation!</p>';
    return;
  }
  
  currentConversation.messages.forEach(message => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.senderId === currentUserId ? 'sent' : 'received'}`;
    
    messageDiv.innerHTML = `
      <div class="message-content">${message.message}</div>
      <div class="message-time">${formatTime(message.timestamp)}</div>
    `;
    
    messagesContent.appendChild(messageDiv);
  });
  
  // Scroll to bottom
  messagesContent.scrollTop = messagesContent.scrollHeight;
}

function updateChatHeader() {
  if (!currentConversation) return;
  
  const initials = currentConversation.otherUserName.split(' ').map(n => n[0]).join('').toUpperCase();
  
  document.querySelector('.messages-header').style.display = 'flex';
  document.querySelector('.chat-avatar').textContent = initials;
  document.querySelector('.chat-user-name').textContent = currentConversation.otherUserName;
}

function formatTime(timestamp) {
  const date = new Date(timestamp + 'Z'); // Ensure UTC parsing
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  
  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffHours < 48) {
    return 'Yesterday ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }
}

// Send message functionality
document.addEventListener('DOMContentLoaded', function() {
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  
  // Auto-resize textarea
  function autoResize() {
    messageInput.style.height = 'auto';
    const scrollHeight = messageInput.scrollHeight;
    const maxHeight = 96; // 6rem max-height
    messageInput.style.height = Math.min(scrollHeight, maxHeight) + 'px';
  }
  
  messageInput.addEventListener('input', autoResize);
  
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});

async function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const messageText = messageInput.value.trim();
  
  if (!messageText || !currentConversation) return;
  
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receiverId: currentConversation.otherUserId,
        message: messageText
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    // Clear input and reset height
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Reload conversations to show new message
    await loadConversations();
    
    // Reselect current conversation
    const conversationIndex = conversations.findIndex(c => c.otherUserId === currentConversation.otherUserId);
    if (conversationIndex !== -1) {
      selectConversation(conversationIndex);
    }
    
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
}