const Amplify = window.aws_amplify.Amplify;
const Auth = Amplify.Auth;

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
      const isAdmin = await checkAdminStatus();
      if (isAdmin) {
        await loadAdminDashboard();
      } else {
        showAccessDenied();
      }
    })
    .catch(() => {
      window.location.replace("logIn.html");
    });

  const signOutBtn = document.getElementById("signOut");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        await Auth.signOut();
        window.location.replace("logIn.html");
      } catch (err) {
        alert("Sign out error: " + err.message);
      }
    });
  }
};

async function checkAdminStatus() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch('https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/users/all', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

function showAccessDenied() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('access-denied').style.display = 'block';
}

async function loadAdminDashboard() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('admin-content').style.display = 'block';
  await loadAllUsers();
}

async function loadAllUsers() {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch('https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/users/all', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const tableContainer = document.getElementById('users-table');
    
    if (!response.ok) {
      tableContainer.innerHTML = '<p>Error loading users.</p>';
      return;
    }
    
    const users = await response.json();
    
    if (users.length === 0) {
      tableContainer.innerHTML = '<p>No users found.</p>';
      return;
    }
    
    displayUsersTable(users, tableContainer);
    
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('users-table').innerHTML = '<p>Error loading users.</p>';
  }
}

function displayUsersTable(users, container) {
  let tableHTML = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
      <thead>
        <tr style="background-color: #f0f4ff; border-bottom: 2px solid #012572;">
          <th style="padding: 1rem; text-align: left; color: #012572;">Name</th>
          <th style="padding: 1rem; text-align: left; color: #012572;">Email</th>
          <th style="padding: 1rem; text-align: left; color: #012572;">Type</th>
          <th style="padding: 1rem; text-align: left; color: #012572;">Consent Form</th>
          <th style="padding: 1rem; text-align: left; color: #012572;">Interest Form</th>
          <th style="padding: 1rem; text-align: left; color: #012572;">Admin</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  users.forEach(user => {
    const name = sanitizeText(user.name);
    const email = sanitizeText(user.email);
    const type = sanitizeText(user.type);
    const consent = user.hasConsent ? '✓' : '✗';
    const interest = user.hasInterest ? '✓' : '✗';
    const admin = user.isAdmin ? '✓' : '✗';
    
    tableHTML += `
      <tr style="border-bottom: 1px solid #e0e7ff;">
        <td style="padding: 0.75rem;">${name}</td>
        <td style="padding: 0.75rem;">${email}</td>
        <td style="padding: 0.75rem;">${type}</td>
        <td style="padding: 0.75rem; text-align: center;">${consent}</td>
        <td style="padding: 0.75rem; text-align: center;">${interest}</td>
        <td style="padding: 0.75rem; text-align: center;">${admin}</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table>';
  container.innerHTML = tableHTML;
}

