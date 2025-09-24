document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signup_form");
  const result = document.getElementById("result");
  const dobInput = document.getElementById("dob_input");
  const seniorCodeField = document.getElementById("senior_code_field");
  const seniorCodeInput = document.getElementById("senior_code");

  if (!form) return;

  // Show/hide senior code field based on date of birth
  if (dobInput && seniorCodeField) {
    dobInput.addEventListener("change", function() {
      const birthYear = new Date(this.value).getFullYear();
      if (birthYear < 1995) {
        seniorCodeField.style.display = "block";
        seniorCodeInput.required = true;
      } else {
        seniorCodeField.style.display = "none";
        seniorCodeInput.required = false;
        seniorCodeInput.value = "";
      }
    });
  }

  form.addEventListener("submit", async function(event) {
    event.preventDefault();
    
    const password = document.getElementById("pw_input").value;
    const confirmPassword = document.getElementById("conf_pw_input").value;
    const birthdate = document.getElementById("dob_input").value;
    const seniorCode = document.getElementById("senior_code").value;
    
    if (password !== confirmPassword) {
      if (result) {
        result.textContent = "Error: Passwords do not match";
        result.style.color = "red";
      }
      return;
    }
    
    // Check senior code if birth year is before 1995
    const birthYear = new Date(birthdate).getFullYear();
    if (birthYear < 1995 && (!seniorCode || seniorCode.length !== 6)) {
      if (result) {
        result.textContent = "Error: Please enter a valid 6-letter resident access code";
        result.style.color = "red";
      }
      return;
    }
    
    const email = document.getElementById("email_input").value;
    const givenName = document.getElementById("first_input").value;
    const familyName = document.getElementById("last_input").value;

    try {
      await Auth.signUp({
        username: email,
        password,
        attributes: {
          birthdate,
          given_name: givenName,
          family_name: familyName,
          address: seniorCode || ''
        }
      });

      localStorage.setItem("signupEmail", email);
      window.location.replace("verify.html");
      
    } catch (err) {
      if (err.message === "PreSignUp failed with error Invalid senior access code.") {
        if (result) result.textContent = "Error: Incorrect resident access code.";
      } else
      if (result) result.textContent = "Error: " + err.message;
    }
  });
});