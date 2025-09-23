const Amplify = window.aws_amplify.Amplify;
const Auth = Amplify.Auth;
const API = Amplify.API;

window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      const name = user?.attributes?.given_name || "Friend";
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
  },
  API: {
    endpoints: [
      {
        name: "brightbondsapi",
        endpoint: "https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws",
        custom_header: async () => {
          return { Authorization: `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}` }
        }
      }
    ]
  }
});

document.getElementById("match_form").addEventListener("submit", async (e) => {
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
  
  console.log("Form data collected:", data);

  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    
    const response = await fetch("https://p3wsr6si354o4xw35baf3yo5tm0nhbxn.lambda-url.us-east-2.on.aws/", {
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
    console.log(result);
    
    // Show success message
    const successDiv = document.createElement('div');
    successDiv.innerHTML = `
      <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; text-align: center;">
        <h3 style="margin: 0 0 0.5rem 0; color: #155724;">Interest Form Submitted Successfully!</h3>
        <p style="margin: 0; font-size: 1rem;">Thank you for completing your profile. We'll work on finding you a great match!</p>
        <button onclick="window.location.href='home.html'" class="submitButton" style="margin-top: 1rem;">Go to Home</button>
      </div>
    `;
    
    // Hide form and show success message
    document.getElementById('match_form').style.display = 'none';
    document.getElementById('match_form').parentNode.appendChild(successDiv);
  } catch (err) {
    console.error("Form submission error:", err);
    alert("There was an error submitting the form.");
  }
});
