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

window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      await loadMatches(user.attributes.sub);
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

async function loadMatches(userId) {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    // Get user's matches from API Gateway
    const response = await fetch(`https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/matches/${userId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    document.getElementById('loading').style.display = 'none';
    
    if (response.status === 404) {
      document.getElementById('no-matches').style.display = 'block';
      return;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const matches = await response.json();
    displayMatches(matches);
    
  } catch (error) {
    console.error('Error loading matches:', error);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('no-matches').style.display = 'block';
  }
}

function displayMatches(matches) {
  const container = document.getElementById('matches-list');
  const matchesContainer = document.getElementById('matches-container');
  
  if (!matches || matches.length === 0) {
    document.getElementById('no-matches').style.display = 'block';
    return;
  }
  
  matchesContainer.style.display = 'block';
  
  matches.forEach(match => {
    const matchDiv = document.createElement('div');
    matchDiv.className = 'match-card';
    matchDiv.style.cssText = `
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
      background: white;
    `;
    
    const sharedInterests = match.sharedInterests && match.sharedInterests.length > 0 
      ? match.sharedInterests.join(', ') 
      : 'No shared interests listed';
    
    matchDiv.innerHTML = `
      <h3>Your Match: ${match.matchedUserFirstName || 'Unknown'}</h3>
      <p><strong>Compatibility Score:</strong> ${match.compatibilityScore}</p>
      <p><strong>Location:</strong> ${match.seniorFacility || match.studentLocation}</p>
      <p><strong>Shared Interests:</strong> ${sharedInterests}</p>
      <p><strong>Matched On:</strong> ${new Date(match.createdAt).toLocaleDateString()}</p>
    `;
    
    container.appendChild(matchDiv);
  });
}



async function runMatching() {
  try {
    const response = await fetch('https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/matching', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const result = await response.json();
      alert(`Matching algorithm completed! ${result.message}`);
      location.reload();
    } else {
      alert('Error running matching algorithm. Please try again.');
    }
  } catch (error) {
    console.error('Error running matching:', error);
    alert('Error running matching algorithm. Please try again.');
  }
}