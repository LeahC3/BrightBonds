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
};

async function loadMatches(userId) {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    // Get user's matches
    const response = await fetch(`https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/matches/${userId}`, {
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
      <h3>Match Found!</h3>
      <p><strong>Compatibility Score:</strong> ${match.compatibilityScore}</p>
      <p><strong>Location:</strong> ${match.seniorFacility || match.studentLocation}</p>
      <p><strong>Shared Interests:</strong> ${sharedInterests}</p>
      <p><strong>Status:</strong> ${match.status}</p>
      <p><strong>Created:</strong> ${new Date(match.createdAt).toLocaleDateString()}</p>
      
      ${match.status === 'pending' ? `
        <div style="margin-top: 1rem;">
          <button onclick="acceptMatch('${match.matchId}')" class="submitButton" style="margin-right: 1rem;">Accept Match</button>
          <button onclick="declineMatch('${match.matchId}')" style="background: #dc3545;">Decline Match</button>
        </div>
      ` : ''}
    `;
    
    container.appendChild(matchDiv);
  });
}

async function acceptMatch(matchId) {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/matches/${matchId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      alert('Match accepted! You can now start connecting.');
      location.reload();
    } else {
      alert('Error accepting match. Please try again.');
    }
  } catch (error) {
    console.error('Error accepting match:', error);
    alert('Error accepting match. Please try again.');
  }
}

async function declineMatch(matchId) {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch(`https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/matches/${matchId}/decline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      alert('Match declined.');
      location.reload();
    } else {
      alert('Error declining match. Please try again.');
    }
  } catch (error) {
    console.error('Error declining match:', error);
    alert('Error declining match. Please try again.');
  }
}

async function runMatching() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch('https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/run-matching', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      alert('Matching algorithm completed! Refreshing your matches...');
      location.reload();
    } else {
      alert('Error running matching algorithm. Please try again.');
    }
  } catch (error) {
    console.error('Error running matching:', error);
    alert('Error running matching algorithm. Please try again.');
  }
}