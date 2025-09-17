const Amplify = window.aws_amplify.Amplify;
const Auth = Amplify.Auth;

window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      const name = user?.attributes?.given_name || "Friend";
      // Pre-fill student name if available
      const studentNameField = document.getElementById('studentName');
      if (studentNameField && user?.attributes?.given_name && user?.attributes?.family_name) {
        studentNameField.value = `${user.attributes.given_name} ${user.attributes.family_name}`;
      }
      
      // Pre-fill student DOB if available
      const studentDOBField = document.getElementById('studentDOB');
      if (studentDOBField && user?.attributes?.birthdate) {
        studentDOBField.value = user.attributes.birthdate;
      }
      
      // Set today's date for signature
      const signatureDateField = document.getElementById('signatureDate');
      if (signatureDateField) {
        signatureDateField.value = new Date().toISOString().split('T')[0];
      }
    })
    .catch(() => {
      window.location.replace("login.html");
    });
};

// Configure Amplify
aws_amplify.Amplify.configure({
  Auth: {
    region: 'us-east-2',
    userPoolId: 'us-east-2_AxTL9MRLy',
    userPoolWebClientId: '69hs07li090olcre8pg8uji24r',
  }
});

document.getElementById("consent_form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    if (data[key]) {
      if (Array.isArray(data[key])) data[key].push(value);
      else data[key] = [data[key], value];
    } else {
      data[key] = value;
    }
  }
  
  console.log("Consent form data collected:", data);

  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const consentUrl = "https://arvatouve62zwtuw2milljprru0zeuvd.lambda-url.us-east-2.on.aws/";
    console.log("Submitting consent form to:", consentUrl);
    const response = await fetch(consentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`HTTP ${response.status} - ${message}`);
    }

    const result = await response.json();
    alert("Consent form submitted successfully! You can now complete your interest form.");
    console.log(result);
    
    // Redirect to student form
    window.location.href = "studentForm.html";
  } catch (err) {
    console.error("Consent form submission error:", err);
    alert("There was an error submitting the consent form.");
  }
});