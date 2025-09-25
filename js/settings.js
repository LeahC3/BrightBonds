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

window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      currentUserId = user.attributes.sub;
      await loadUserSettings();
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

  // Settings event listeners
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
};

async function loadUserSettings() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'getSettings', userId: currentUserId })
    });
    
    if (response.status === 200) {
      const settings = await response.json();
      applySettings(settings);
    } else {
      // Use default settings if none found
      applyDefaultSettings();
    }
  } catch (error) {
    console.log('Settings load failed, using defaults');
    applyDefaultSettings();
  }
}

function applySettings(settings) {
  document.getElementById('emailNotifications').checked = settings.emailNotifications !== false;
  document.getElementById('matchNotifications').checked = settings.matchNotifications !== false;
  document.getElementById('profileVisibility').checked = settings.profileVisibility !== false;
  document.getElementById('language').value = settings.language || 'en';
  document.getElementById('theme').value = settings.theme || 'light';
}

function applyDefaultSettings() {
  document.getElementById('emailNotifications').checked = true;
  document.getElementById('matchNotifications').checked = true;
  document.getElementById('profileVisibility').checked = true;
  document.getElementById('language').value = 'en';
  document.getElementById('theme').value = 'light';
}

async function saveSettings() {
  try {
    const settings = {
      emailNotifications: document.getElementById('emailNotifications').checked,
      matchNotifications: document.getElementById('matchNotifications').checked,
      profileVisibility: document.getElementById('profileVisibility').checked,
      language: document.getElementById('language').value,
      theme: document.getElementById('theme').value
    };

    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        action: 'saveSettings', 
        userId: currentUserId,
        settings: settings
      })
    });
    
    if (response.ok) {
      // Show success message
      const saveBtn = document.getElementById('saveSettings');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      saveBtn.style.backgroundColor = '#28a745';
      
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.backgroundColor = '#012572';
      }, 2000);
    } else {
      alert('Failed to save settings. Please try again.');
    }
    
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Failed to save settings. Please try again.');
  }
}

function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    applyDefaultSettings();
  }
}