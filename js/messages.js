const Amplify = window.aws_amplify.Amplify;
const Auth = Amplify.Auth;

window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      const name = user?.attributes?.given_name || "Friend";
    })
    .catch(() => {
      window.location.replace("login.html");
    });

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

  // Sign out functionality
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

  // Message functionality
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const messagesContent = document.getElementById('messagesContent');

  function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message sent';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = messageText;
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageTime);
    messagesContent.appendChild(messageDiv);
    
    // Clear input
    messageInput.value = '';
    
    // Scroll to bottom
    messagesContent.scrollTop = messagesContent.scrollHeight;
  }

  if (sendButton && messageInput) {
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  // Conversation switching
  const conversationItems = document.querySelectorAll('.conversation-item');
  conversationItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all items
      conversationItems.forEach(i => i.classList.remove('active'));
      // Add active class to clicked item
      item.classList.add('active');
      
      // Update chat header
      const userName = item.dataset.user;
      const chatUserName = document.querySelector('.chat-user-name');
      const chatAvatar = document.querySelector('.chat-avatar');
      
      if (chatUserName) chatUserName.textContent = userName;
      if (chatAvatar) {
        const initials = userName.split(' ').map(n => n[0]).join('');
        chatAvatar.textContent = initials;
      }
      
      // Clear messages (in real app, would load conversation)
      if (messagesContent) {
        messagesContent.innerHTML = '<div class="message received"><div class="message-content">Start a conversation with ' + userName + '!</div><div class="message-time">Now</div></div>';
      }
    });
  });
};