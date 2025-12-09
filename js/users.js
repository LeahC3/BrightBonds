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
    
    const response = await fetch('https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/matches/users/all', {
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
    
    const response = await fetch('https://j65hehh767.execute-api.us-east-2.amazonaws.com/dev/matches/users/all', {
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
  const students = users.filter(u => u.type === 'Student').sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
  const residents = users.filter(u => u.type === 'Resident').sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
  
  let tableHTML = `
    <h4 style="color: #012572; margin-top: 2rem; margin-bottom: 0.5rem;">Students (${students.length})</h4>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
      <thead>
        <tr style="background-color: #f0f4ff; border-bottom: 2px solid #012572;">
          <th style="padding: 1rem; text-align: left; color: #012572;">Name</th>
          <th style="padding: 1rem; text-align: left; color: #012572;">Email</th>
          <th style="padding: 1rem; text-align: center; color: #012572;">Email Verified</th>
          <th style="padding: 1rem; text-align: center; color: #012572;">Consent Form</th>
          <th style="padding: 1rem; text-align: center; color: #012572;">Interest Form</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  students.forEach(user => {
    const name = sanitizeText(user.name) + (user.isAdmin ? ' <span style="color: #012572; font-weight: bold;">(Admin)</span>' : '');
    const email = sanitizeText(user.email);
    const verified = user.emailVerified ? '<span style="color: green;">&#10003;</span>' : '<span style="color: red;">&#10007;</span>';
    const consent = user.hasConsent ? '<span style="color: green;">&#10003;</span>' : '<span style="color: red;">&#10007;</span>';
    const interest = user.hasInterest ? '<span style="color: green;">&#10003;</span>' : '<span style="color: red;">&#10007;</span>';
    const isComplete = user.emailVerified && user.hasConsent && user.hasInterest;
    const rowStyle = isComplete ? 'background-color: #d4edda; border-bottom: 1px solid #e0e7ff;' : 'border-bottom: 1px solid #e0e7ff;';
    
    tableHTML += `
      <tr style="${rowStyle}">
        <td style="padding: 0.75rem;">${name}</td>
        <td style="padding: 0.75rem;">${email}</td>
        <td style="padding: 0.75rem; text-align: center;">${verified}</td>
        <td style="padding: 0.75rem; text-align: center;">${consent}</td>
        <td style="padding: 0.75rem; text-align: center;">${interest}</td>
      </tr>
    `;
  });
  
  tableHTML += `</tbody></table>
    <h4 style="color: #012572; margin-top: 2rem; margin-bottom: 0.5rem;">Residents (${residents.length})</h4>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f0f4ff; border-bottom: 2px solid #012572;">
          <th style="padding: 1rem; text-align: left; color: #012572;">Name</th>
          <th style="padding: 1rem; text-align: left; color: #012572;">Email</th>
          <th style="padding: 1rem; text-align: center; color: #012572;">Email Verified</th>
          <th style="padding: 1rem; text-align: center; color: #012572;">Consent Form</th>
          <th style="padding: 1rem; text-align: center; color: #012572;">Interest Form</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  residents.forEach(user => {
    const name = sanitizeText(user.name) + (user.isAdmin ? ' <span style="color: #012572; font-weight: bold;">(Admin)</span>' : '');
    const email = sanitizeText(user.email);
    const verified = user.emailVerified ? '<span style="color: green;">&#10003;</span>' : '<span style="color: red;">&#10007;</span>';
    const consent = user.hasConsent ? '<span style="color: green;">&#10003;</span>' : '<span style="color: red;">&#10007;</span>';
    const interest = user.hasInterest ? '<span style="color: green;">&#10003;</span>' : '<span style="color: red;">&#10007;</span>';
    const isComplete = user.emailVerified && user.hasConsent && user.hasInterest;
    const rowStyle = isComplete ? 'background-color: #ddf8e4ff; border-bottom: 1px solid #e0e7ff;' : 'border-bottom: 1px solid #e0e7ff;';
    
    tableHTML += `
      <tr style="${rowStyle}">
        <td style="padding: 0.75rem;">${name}</td>
        <td style="padding: 0.75rem;">${email}</td>
        <td style="padding: 0.75rem; text-align: center;">${verified}</td>
        <td style="padding: 0.75rem; text-align: center;">${consent}</td>
        <td style="padding: 0.75rem; text-align: center;">${interest}</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table>';
  container.innerHTML = tableHTML;
}

