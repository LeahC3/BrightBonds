window.onload = function () {
  const form = document.getElementById("signup_form");
  if (!form || !window.Auth) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const email = document.getElementById("email_input").value;
    const givenName = document.getElementById("first_input").value;
    const familyName = document.getElementById("last_input").value;
    const birthdate = document.getElementById("dob_input").value;
    const password = document.getElementById("pw_input").value;

    try {
      await Auth.signUp({
        username: email,
        password,
        attributes: {
          birthdate,
          given_name: givenName,
          family_name: familyName,
        }
      });

      localStorage.setItem("signupEmail", email);
      localStorage.setItem("signupPassword", password);
      window.location.replace("verify.html");
    } catch (err) {
      if (result) result.textContent = "Signup failed: " + err.message;
    }
  });
};
