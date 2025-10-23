window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      const name = user?.attributes?.given_name || "Friend";
      const welcomeEl = document.getElementById("welcome_name");
      if (welcomeEl) welcomeEl.textContent = name;
      
      // Check if user is admin
      const isAdmin = user?.attributes?.middle_name === 'ADMIN';
      if (isAdmin) {
        // Skip form checks for admin users
        return;
      }
      
      // Determine correct form based on birthdate and age
      const birthdate = user?.attributes?.birthdate;
      let formUrl = "matchForm.html";
      
      if (birthdate) {
        const birthDate = new Date(birthdate);
        const today = new Date();
        const birthYear = birthDate.getFullYear();
        
        // Calculate actual age
        let age = today.getFullYear() - birthYear;
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        const isStudent = birthYear > 1995;
        
        
        if (isStudent && age < 18) {
          // Minor needs consent form first
          formUrl = "consentForm.html";

        } else if (isStudent) {
          // Adult student goes to student form
          formUrl = "studentForm.html";
        } else {
          // Senior needs consent form first
          formUrl = "seniorConsentForm.html";
        }
        
        // Set matchLink if it exists
        const matchLink = document.getElementById("matchLink");
        if (matchLink) {
          matchLink.href = formUrl;
        }
      }
      
      // Check if user has completed their form
      await checkFormCompletion(user.attributes.sub, formUrl);
      
      // Check for unread messages
      await checkUnreadMessages();
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

async function checkFormCompletion(userId, formUrl) {
  try {
    console.log(`Checking form completion for user: ${userId}`);
    console.log(`Request URL: https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/check/${userId}`);
    
    // Check form completion status using submitUserForm endpoint (it checks both tables)
    const response = await fetch(`https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'check', userId: userId })
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, response.headers);
    
    let hasConsent = false;
    let hasInterest = false;
    
    if (response.status === 200) {
      const data = await response.json();
      hasConsent = data.hasConsent;
      hasInterest = data.hasInterest;
    }
    
    // Check if user needs consent form
    if (formUrl.includes('consentForm.html')) {
      // Minor student consent
      if (!hasConsent) {
        showFormNotification(formUrl);
      } else if (!hasInterest) {
        showFormNotification('studentForm.html');
      } else {
        hideNotification();
      }
    } else if (formUrl.includes('seniorConsentForm.html')) {
      // Senior consent
      if (!hasConsent) {
        showFormNotification(formUrl);
      } else if (!hasInterest) {
        showFormNotification('seniorForm.html');
      } else {
        hideNotification();
      }
    } else {
      // Adult student - just check interest form
      if (!hasInterest) {
        showFormNotification(formUrl);
      } else {
        hideNotification();
      }
    }
  } catch (error) {
    console.log('Form check failed, showing notification');
    showFormNotification(formUrl);
  }
}

function showFormNotification(formUrl) {
  const notifications = document.getElementById('notifications');
  const completeBtn = document.getElementById('completeFormBtn');
  const notificationText = document.querySelector('.notification-content p');
  
  if (notifications) {
    notifications.style.display = 'block';
  }
  
  // Update notification text based on form type
  if (notificationText && formUrl.includes('consentForm.html')) {
    notificationText.textContent = 'As a minor, you need parental consent before completing your interest form and finding a match.';
  } else if (notificationText && formUrl.includes('seniorConsentForm.html')) {
    notificationText.textContent = 'Please complete your consent form before filling out your interest form and finding a match.';
  } else if (notificationText && formUrl.includes('studentForm.html')) {
    notificationText.textContent = 'Please complete your interest form to get matched with a senior partner.';
  } else if (notificationText && formUrl.includes('seniorForm.html')) {
    notificationText.textContent = 'Please complete your interest form to get matched with a student volunteer.';
  }
  
  if (completeBtn) {
    completeBtn.onclick = () => window.location.href = formUrl;
  }
}

function hideNotification() {
  const notifications = document.getElementById('notifications');
  if (notifications) notifications.style.display = 'none';
}

async function checkUnreadMessages() {
  try {
    const response = await fetch('https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/messages/unread', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.unreadCount > 0) {
        showUnreadNotification(data.unreadCount);
      }
    }
  } catch (error) {
    console.log('Failed to check unread messages:', error);
  }
}

function showUnreadNotification(count) {
  const unreadNotifications = document.getElementById('unreadNotifications');
  const unreadText = document.getElementById('unreadText');
  
  if (unreadNotifications) {
    unreadNotifications.style.display = 'block';
  }
  
  if (unreadText) {
    unreadText.textContent = count === 1 ? 
      'You have 1 unread message from your matches.' : 
      `You have ${count} unread messages from your matches.`;
  }
}
