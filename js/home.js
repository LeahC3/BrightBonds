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
          // Senior goes to senior form
          formUrl = "seniorForm.html";
        }
        
        // Set matchLink if it exists
        const matchLink = document.getElementById("matchLink");
        if (matchLink) {
          matchLink.href = formUrl;
        }
      }
      
      // Check if user has completed their form
      await checkFormCompletion(user.attributes.sub, formUrl);
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
    
    // Check if user needs consent form (under 18)
    if (formUrl.includes('consent')) {
      if (!hasConsent) {
        showFormNotification(formUrl);
      } else if (!hasInterest) {
        showFormNotification('studentForm.html');
      } else {
        hideNotification();
      }
    } else {
      // Adult or senior - just check interest form
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
  if (notificationText && formUrl.includes('consent')) {
    notificationText.textContent = 'As a minor, you need parental consent before completing your interest form and finding a match.';
  } else if (notificationText && formUrl.includes('student')) {
    notificationText.textContent = 'Please complete your interest form to get matched with a senior partner.';
  }
  
  if (completeBtn) {
    completeBtn.onclick = () => window.location.href = formUrl;
  }
}

function hideNotification() {
  const notifications = document.getElementById('notifications');
  if (notifications) notifications.style.display = 'none';
}
