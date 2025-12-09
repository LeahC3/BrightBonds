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

let allUsers = [];

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
    
    allUsers = await response.json();
    
    if (allUsers.length === 0) {
      tableContainer.innerHTML = '<p>No users found.</p>';
      return;
    }
    
    displayUsersTable(allUsers, tableContainer, 'newest');
    
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('users-table').innerHTML = '<p>Error loading users.</p>';
  }
}

function sortUsers(users, sortBy) {
  const sorted = [...users];
  switch(sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate));
    case 'firstName':
      return sorted.sort((a, b) => {
        const firstA = a.name.split(' ')[0];
        const firstB = b.name.split(' ')[0];
        return firstA.localeCompare(firstB);
      });
    case 'lastName':
      return sorted.sort((a, b) => {
        const lastA = a.name.split(' ').slice(-1)[0];
        const lastB = b.name.split(' ').slice(-1)[0];
        return lastA.localeCompare(lastB);
      });
    default:
      return sorted;
  }
}

function displayUsersTable(users, container, sortBy = 'newest') {
  const students = sortUsers(users.filter(u => u.type === 'Student'), sortBy);
  const residents = sortUsers(users.filter(u => u.type === 'Resident'), sortBy);
  
  let tableHTML = `
    <style>
      @media (max-width: 768px) {
        .users-table th, .users-table td { padding: 0.4rem 0.2rem !important; font-size: 0.85rem; }
        .users-table th:first-child, .users-table td:first-child { padding-left: 0.4rem !important; }
        .users-table th:last-child, .users-table td:last-child { padding-right: 0.4rem !important; }
      }
    </style>
    <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 1rem;">
      <label for="sortBy" style="color: #012572; margin-right: 0.5rem; font-size: 0.9rem;">Sort by:</label>
      <select id="sortBy" style="padding: 0.4rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; color: #333; font-size: 0.9rem; background-color: white;" onchange="handleSortChange(this.value)">
        <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Newest</option>
        <option value="oldest" ${sortBy === 'oldest' ? 'selected' : ''}>Oldest</option>
        <option value="firstName" ${sortBy === 'firstName' ? 'selected' : ''}>First Name (A-Z)</option>
        <option value="lastName" ${sortBy === 'lastName' ? 'selected' : ''}>Last Name (A-Z)</option>
      </select>
    </div>
    <h4 style="color: #012572; margin-top: 1rem; margin-bottom: 0.5rem;">Students (${students.length})</h4>
    <table class="users-table" style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
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
        <td style="padding: 0.5rem; text-align: center;">${verified}</td>
        <td style="padding: 0.5rem; text-align: center;">${consent}</td>
        <td style="padding: 0.5rem; text-align: center;">${interest}</td>
      </tr>
    `;
  });
  
  tableHTML += `</tbody></table>
    <h4 style="color: #012572; margin-top: 2rem; margin-bottom: 0.5rem;">Residents (${residents.length})</h4>
    <table class="users-table" style="width: 100%; border-collapse: collapse;">
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
        <td style="padding: 0.5rem; text-align: center;">${verified}</td>
        <td style="padding: 0.5rem; text-align: center;">${consent}</td>
        <td style="padding: 0.5rem; text-align: center;">${interest}</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table>';
  container.innerHTML = tableHTML;
}


function handleSortChange(sortBy) {
  const tableContainer = document.getElementById('users-table');
  displayUsersTable(allUsers, tableContainer, sortBy);
}
