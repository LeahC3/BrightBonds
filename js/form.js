const Amplify = window.aws_amplify.Amplify;
const Auth = Amplify.Auth;

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

  try {
    const session = await Auth.currentSession();  // <-- Better than currentAuthenticatedUser
    const token = session.getIdToken().getJwtToken();

    const response = await fetch("https://1asmlb4abc.execute-api.us-east-2.amazonaws.com/default/submitUserForm-dev", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`HTTP ${response.status} - ${message}`);
    }

    const result = await response.json();
    alert("Form submitted successfully!");
    console.log(result);
  } catch (err) {
    console.error("Form submission error:", err);
    alert("There was an error submitting the form.");
  }
});
