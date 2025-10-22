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
let isAdmin = false;

window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      currentUserId = user.attributes.sub;
      
      // Check if user is admin - will be determined by server response
      isAdmin = false; // Default to false, will be set by server response
      // Try to load admin conversations first
      await loadAllConversations();
      
      // Update UI based on admin status
      if (isAdmin) {
        // Hide message input for admins (monitoring only)
        document.querySelector('.message-input-container').style.display = 'none';
        // Add admin indicator
        document.querySelector('.messages-sidebar h2').textContent = 'All Conversations (Admin)';
      }
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
  

};

async function loadAllConversations() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages/all`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 403) {
      // Not an admin, load regular conversations instead
      isAdmin = false;
      await loadConversations();
      return;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    // If we get here, user is admin
    isAdmin = true;
    
    conversations = await response.json();
    displayConversations();
    
    // Select first conversation if available
    if (conversations.length > 0) {
      selectConversation(0);
    }
    
    // Start auto-refresh for new messages
    startAutoRefresh();
    
  } catch (error) {
    // Suppress 403 errors (expected for non-admin users)
    if (!error.message.includes('403')) {
      console.error('Error loading all conversations:', error);
    }
    document.getElementById('conversationList').innerHTML = '<p>No conversations found.</p>';
  }
}

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
    const oldMessages = currentConversation?.messages || [];
    const oldHasMore = currentConversation?.hasMore;
    const messagesContent = document.getElementById('messagesContent');
    const scrollPosition = messagesContent?.scrollTop;
    
    // Mark as refreshing to prevent scroll jumping
    if (messagesContent) {
      messagesContent.setAttribute('data-refreshing', 'true');
    }
    
    // Call appropriate function based on admin status
    if (isAdmin) {
      await loadAllConversations();
    } else {
      await loadConversations();
    }
    
    // Reselect the same conversation if it still exists
    if (oldConversationId) {
      const conversationIndex = conversations.findIndex(c => c.otherUserId === oldConversationId);
      if (conversationIndex !== -1) {
        // Preserve loaded messages if user had loaded more
        if (oldMessages.length > conversations[conversationIndex].messages.length) {
          conversations[conversationIndex].messages = oldMessages;
          conversations[conversationIndex].hasMore = oldHasMore;
        }
        selectConversation(conversationIndex);
        
        // Restore scroll position immediately
        if (scrollPosition !== undefined && messagesContent) {
          messagesContent.scrollTop = scrollPosition;
        }
      }
    }
    
    // Remove refreshing flag
    if (messagesContent) {
      messagesContent.removeAttribute('data-refreshing');
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

async function selectConversation(index) {
  // Remove active class from all conversations
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Add active class to selected conversation
  document.querySelectorAll('.conversation-item')[index].classList.add('active');
  
  currentConversation = conversations[index];
  displayMessages();
  updateChatHeader();
  
  // Mark messages as read for non-admin users
  if (!isAdmin && currentConversation) {
    await markMessagesAsRead(currentConversation.otherUserId);
  }
}

function displayMessages() {
  const messagesContent = document.getElementById('messagesContent');
  messagesContent.innerHTML = '';
  
  if (!currentConversation || currentConversation.messages.length === 0) {
    messagesContent.innerHTML = '<p>No messages yet. Start the conversation!</p>';
    return;
  }
  
  // Add Load More button if there are more messages
  if (currentConversation.hasMore) {
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.style.cssText = 'text-align: center; padding: 1rem; border-bottom: 1px solid #e0e7ff;';
    loadMoreDiv.innerHTML = `
      <button onclick="loadMoreMessages()" style="
        background-color: #f0f4ff;
        color: #012572;
        border: 1px solid #012572;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 0.9rem;
      ">Load More Messages (${currentConversation.totalMessages - currentConversation.messages.length} older)</button>
    `;
    messagesContent.appendChild(loadMoreDiv);
  }
  
  currentConversation.messages.forEach(message => {
    const messageDiv = document.createElement('div');
    
    if (isAdmin) {
      // For admin view, show sender name and use different colors
      const isStudent = message.senderId === currentConversation.studentId;
      const senderName = isStudent ? currentConversation.studentName : currentConversation.seniorName;
      const backgroundColor = isStudent ? '#f0f4ff' : '#012572';
      const textColor = isStudent ? '#333' : 'white';
      const isReported = message.reported || false;
      
      messageDiv.className = 'message received';
      messageDiv.innerHTML = `
        <div class="message-sender" style="font-size: 0.8rem; color: #666; margin-bottom: 0.25rem;">
          ${senderName}
          ${isReported ? '<span style="color: red; font-weight: bold;"> [REPORTED]</span>' : ''}
        </div>
        <div class="message-content" style="background-color: ${backgroundColor}; color: ${textColor}; ${isReported ? 'border: 2px solid red;' : ''}">${message.message}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
      `;
    } else {
      // For regular users, use sent/received styling
      const canReport = message.senderId !== currentUserId; // Can only report other user's messages
      const isReported = message.reported || false;
      messageDiv.className = `message ${message.senderId === currentUserId ? 'sent' : 'received'}`;
      messageDiv.innerHTML = `
        <div class="message-content">${message.message}</div>
        <div class="message-time">
          ${formatTime(message.timestamp)}
          ${canReport && isReported ? '<span style="color: red; font-size: 0.7rem; margin-left: 0.5rem;">Reported</span> <span class="undo-btn" onclick="undoReport(\'' + (message.messageId || message.senderId + '_' + message.timestamp) + '\')" title="Undo report">Undo</span>' : ''}
          ${canReport && !isReported ? `<span class="report-btn" onclick="reportMessage('${message.messageId || message.senderId + '_' + message.timestamp}')" title="Report message">Report</span>` : ''}
        </div>
      `;
    }
    
    messagesContent.appendChild(messageDiv);
  });
  
  // Only scroll to bottom if user was already at bottom or it's a new conversation
  // Skip auto-scroll during refresh to prevent jumping
  if (!messagesContent.hasAttribute('data-refreshing')) {
    const wasAtBottom = messagesContent.scrollHeight - messagesContent.scrollTop <= messagesContent.clientHeight + 50;
    if (wasAtBottom || !messagesContent.hasAttribute('data-initialized')) {
      messagesContent.scrollTop = messagesContent.scrollHeight;
      messagesContent.setAttribute('data-initialized', 'true');
    }
  }
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

async function reportMessage(messageId) {
  if (!confirm('Report this message as inappropriate?')) return;
  
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages/report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageId: messageId,
        reporterId: currentUserId
      })
    });
    
    if (response.ok) {
      alert('Message reported successfully.');
      // Reload conversations to show updated status
      if (isAdmin) {
        await loadAllConversations();
      } else {
        await loadConversations();
      }
    } else {
      alert('Failed to report message.');
    }
    
  } catch (error) {
    console.error('Error reporting message:', error);
    alert('Failed to report message.');
  }
}

async function undoReport(messageId) {
  if (!confirm('Remove report from this message?')) return;
  
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages/unreport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageId: messageId
      })
    });
    
    if (response.ok) {
      alert('Report removed successfully.');
      // Reload conversations to show updated status
      if (isAdmin) {
        await loadAllConversations();
      } else {
        await loadConversations();
      }
    } else {
      alert('Failed to remove report.');
    }
    
  } catch (error) {
    console.error('Error removing report:', error);
    alert('Failed to remove report.');
  }
}

async function loadMoreMessages() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const currentOffset = currentConversation.messages.length;
    const endpoint = isAdmin ? 
      `https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages/all?offset=${currentOffset}&limit=50` :
      `https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages?offset=${currentOffset}&limit=50`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const newConversations = await response.json();
      const currentConvId = currentConversation.otherUserId;
      const newConversation = newConversations.find(c => c.otherUserId === currentConvId);
      
      if (newConversation && newConversation.messages.length > 0) {
        // Prepend older messages to current messages
        currentConversation.messages = [...newConversation.messages, ...currentConversation.messages];
        currentConversation.hasMore = newConversation.hasMore;
        currentConversation.totalMessages = newConversation.totalMessages;
        
        // Save scroll position
        const messagesContent = document.getElementById('messagesContent');
        const oldScrollHeight = messagesContent.scrollHeight;
        
        displayMessages();
        
        // Restore scroll position (maintain position relative to old content)
        const newScrollHeight = messagesContent.scrollHeight;
        messagesContent.scrollTop = newScrollHeight - oldScrollHeight;
        
        // Update conversations array
        const convIndex = conversations.findIndex(c => c.otherUserId === currentConvId);
        if (convIndex !== -1) {
          conversations[convIndex] = currentConversation;
        }
      }
    }
  } catch (error) {
    console.error('Error loading more messages:', error);
    alert('Failed to load more messages.');
  }
}

async function markMessagesAsRead(otherUserId) {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    await fetch(`https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages/markread`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        otherUserId: otherUserId
      })
    });
  } catch (error) {
    console.log('Failed to mark messages as read:', error);
  }
}