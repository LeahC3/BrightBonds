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
    const result = await API.post('brightbondsapi', '/', {
      body: data
    });
    
    alert("Form submitted successfully!");
    console.log(result);
  } catch (err) {
    console.error("Form submission error:", err);
    alert("There was an error submitting the form.");
  }
});
