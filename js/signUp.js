document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signup_form");
  const result = document.getElementById("result");

  if (!form) return;

  form.addEventListener("submit", async function(event) {
    event.preventDefault();
    
    const password = document.getElementById("pw_input").value;
    const confirmPassword = document.getElementById("conf_pw_input").value;
    
    if (password !== confirmPassword) {
      if (result) {
        result.textContent = "Error: Passwords do not match";
        result.style.color = "red";
      }
      return;
    }
    
    const email = document.getElementById("email_input").value;
    const givenName = document.getElementById("first_input").value;
    const familyName = document.getElementById("last_input").value;
    const birthdate = document.getElementById("dob_input").value;

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
      window.location.replace("verify.html");
      
    } catch (err) {
      if (result) result.textContent = "Signup failed: " + err.message;
    }
  });
});