console.log("Script loaded");

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");

  const AmplifyGlobal = window.aws_amplify;

  if (!AmplifyGlobal) {
    alert("Amplify failed to load.");
    return;
  }

  const { Amplify, Auth } = AmplifyGlobal;

  Amplify.configure({
    Auth: {
      region: 'us-east-2',
      userPoolId: 'us-east-2_AxTL9MRLy',
      userPoolWebClientId: '69hs07li090olcre8pg8uji24r',
    }
  });

  const form = document.getElementById("login_form");
  const result = document.getElementById("result");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault(); // ✅ Prevent form from refreshing the page

      const email = document.getElementById("email_input").value.trim();
      const password = document.getElementById("pw_input").value;

      console.log("Form submitted with:", email, "(password hidden)");

      try {
        const user = await Auth.signIn(email, password);
        result.textContent = "Login successful. Welcome " + (user.attributes?.given_name || "friend") + "!";
      } catch (err) {
        console.error("Login error:", err);
        result.textContent = "Login failed: " + err.message;
      }
    });
  } else {
    console.error("Login form not found.");
  }
});
