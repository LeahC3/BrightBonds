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
      // Check if user is admin
      const isAdmin = user?.attributes?.middle_name === 'ADMIN';
      if (isAdmin) {
        // Show admin controls instead of matches
        showAdminControls();
        return;
      }
      
      // Check if user has completed required forms first
      const formUrl = await checkAndRedirectToForms(user);
      if (!formUrl) {
        // User has completed forms, load matches
        await loadMatches(user.attributes.sub);
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

async function checkAndRedirectToForms(user) {
  try {
    const birthdate = user?.attributes?.birthdate;
    if (!birthdate) return null;
    
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
    
    // Check form completion status
    const response = await fetch(`https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'check', userId: user.attributes.sub })
    });
    
    let hasConsent = false;
    let hasInterest = false;
    
    if (response.status === 200) {
      const data = await response.json();
      hasConsent = data.hasConsent;
      hasInterest = data.hasInterest;
    }
    
    // Determine what form is needed
    if (isStudent && age < 18 && !hasConsent) {
      window.location.replace("consentForm.html");
      return "consentForm.html";
    } else if (isStudent && !hasInterest) {
      window.location.replace("studentForm.html");
      return "studentForm.html";
    } else if (!isStudent && !hasInterest) {
      window.location.replace("seniorForm.html");
      return "seniorForm.html";
    }
    
    return null; // All forms completed
  } catch (error) {
    console.log('Form check failed, allowing matches page to load');
    return null;
  }
}

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
      <h5>Your Match: ${match.matchedUserFirstName || 'Unknown'}</h5>
      <br>
      <p><strong>Compatibility Score:</strong> ${match.compatibilityScore}</p>
      <p><strong>Location:</strong> ${match.seniorFacility || match.studentLocation}</p>
      <p><strong>Shared Interests:</strong> ${sharedInterests}</p>
      <p><strong>Matched On:</strong> ${new Date(match.createdAt).toLocaleDateString()}</p>
    `;
    
    container.appendChild(matchDiv);
  });
}



async function showAdminControls() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('no-matches').style.display = 'none';
  
  const container = document.getElementById('matches-list');
  const matchesContainer = document.getElementById('matches-container');
  
  matchesContainer.style.display = 'block';
  
  container.innerHTML = `
    <div style="padding: 2rem;">
      <h2 style="color: #012572; margin-bottom: 2rem; text-align: center;">Admin Dashboard</h2>
      
      <div style="display: grid; gap: 1rem; max-width: 400px; margin: 0 auto 2rem auto;">
        <button onclick="runMatching()" style="
          background-color: #012572;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1.1rem;
        ">Run Matching Algorithm</button>
        
        <button onclick="window.location.href='messages.html'" style="
          background-color: #012572;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1.1rem;
        ">Monitor Messages</button>
      </div>
      
      <h3 style="color: #012572; margin-bottom: 1rem;">Current Matches</h3>
      <div id="admin-matches-table">Loading matches...</div>
    </div>
  `;
  
  // Load all matches for admin view
  await loadAdminMatches();
}

async function loadAdminMatches() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    // Get all matches from the matches table
    const response = await fetch('https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/matches/all', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const tableContainer = document.getElementById('admin-matches-table');
    
    if (!response.ok) {
      tableContainer.innerHTML = '<p>No matches found or error loading matches.</p>';
      return;
    }
    
    const matches = await response.json();
    
    if (!matches || matches.length === 0) {
      tableContainer.innerHTML = '<p>No matches found.</p>';
      return;
    }
    
    // Create matches table
    let tableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
        <thead>
          <tr style="background-color: #f0f4ff; border-bottom: 2px solid #012572;">
            <th style="padding: 1rem; text-align: left; color: #012572;">Student Name</th>
            <th style="padding: 1rem; text-align: left; color: #012572;">Senior Name</th>
            <th style="padding: 1rem; text-align: left; color: #012572;">Location</th>
            <th style="padding: 1rem; text-align: left; color: #012572;">Compatibility Score</th>
            <th style="padding: 1rem; text-align: left; color: #012572;">Match Date</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    matches.forEach(match => {
      tableHTML += `
        <tr style="border-bottom: 1px solid #e0e7ff;">
          <td style="padding: 0.75rem;">${match.studentName || 'Unknown'}</td>
          <td style="padding: 0.75rem;">${match.seniorName || 'Unknown'}</td>
          <td style="padding: 0.75rem;">${match.location || match.seniorFacility || 'Not specified'}</td>
          <td style="padding: 0.75rem;">${match.compatibilityScore || 'N/A'}</td>
          <td style="padding: 0.75rem;">${new Date(match.createdAt).toLocaleDateString()}</td>
        </tr>
      `;
    });
    
    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
    
  } catch (error) {
    console.error('Error loading admin matches:', error);
    document.getElementById('admin-matches-table').innerHTML = '<p>Error loading matches.</p>';
  }
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