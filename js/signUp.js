console.log("SignUp.js file loaded");

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, looking for form");
  const form = document.getElementById("signup_form");
  const result = document.getElementById("result");
  
  console.log("Form found:", !!form);
  console.log("Result element found:", !!result);

  if (!form) {
    console.log("No form found, exiting");
    return;
  }

  form.addEventListener("submit", function(event) {
    console.log("Form submit event triggered");
    event.preventDefault();
    
    const password = document.getElementById("pw_input").value;
    const confirmPassword = document.getElementById("conf_pw_input").value;
    
    console.log("Password:", password);
    console.log("Confirm Password:", confirmPassword);
    
    if (password !== confirmPassword) {
      console.log("Passwords don't match - stopping submission");
      if (result) {
        result.textContent = "Passwords do not match";
        result.style.color = "red";
      }
      return false;
    }
    
    console.log("Passwords match - would proceed with signup");
    // For now, just log instead of actually signing up
    alert("Form would submit - passwords match!");
  });
});