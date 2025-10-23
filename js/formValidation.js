// Form access validation
// Use existing Amplify configuration from homeMain.js

async function validateFormAccess() {
  try {
    const user = await window.aws_amplify.Amplify.Auth.currentAuthenticatedUser();
    const birthdate = user?.attributes?.birthdate;
    
    if (!birthdate) {
      window.location.replace("home.html");
      return;
    }
    
    const birthDate = new Date(birthdate);
    const today = new Date();
    const birthYear = birthDate.getFullYear();
    
    let age = today.getFullYear() - birthYear;
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    const isStudent = birthYear > 1995;
    const currentPage = window.location.pathname.split('/').pop();
    
    // Check form completion status
    const response = await fetch(`https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${(await window.aws_amplify.Amplify.Auth.currentSession()).getIdToken().getJwtToken()}`,
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
      console.log('Form validation check:', { hasConsent, hasInterest, currentPage });
    }
    
    // Validation logic
    if (currentPage === 'consentForm.html') {
      if (!isStudent || age >= 18 || hasConsent) {
        window.location.replace("home.html");
        return;
      }
    }
    
    if (currentPage === 'seniorConsentForm.html') {
      if (isStudent || hasConsent) {
        window.location.replace("home.html");
        return;
      }
    }
    
    if (currentPage === 'studentForm.html') {
      if (!isStudent) {
        window.location.replace("home.html");
        return;
      }
      if (age < 18 && !hasConsent) {
        window.location.replace("consentForm.html");
        return;
      }
      if (hasInterest) {
        window.location.replace("home.html");
        return;
      }
    }
    
    if (currentPage === 'seniorForm.html') {
      if (isStudent) {
        window.location.replace("home.html");
        return;
      }
      if (!hasConsent) {
        window.location.replace("seniorConsentForm.html");
        return;
      }
      if (hasInterest) {
        window.location.replace("home.html");
        return;
      }
    }
    
  } catch (error) {
    window.location.replace("login.html");
  }
}

// Run validation when page loads
window.addEventListener('load', validateFormAccess);