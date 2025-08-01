window.onload = function () {
  const email = localStorage.getItem("signupEmail");
  if (!email || !window.Auth) {
    alert("Access denied. Please sign up first.");
    window.location.replace("login.html");
    return;
  }

  const emailText = document.getElementById("email_text");
  if (emailText) emailText.textContent = email;

  const form = document.getElementById("verify_form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = document.getElementById("verify_code").value.trim();

      try {
        await Auth.confirmSignUp(email, code);
        const password = localStorage.getItem("signupPassword");
        if (password) {
          await Auth.signIn(email, password);
          localStorage.removeItem("signupEmail");
          localStorage.removeItem("signupPassword");
          window.location.replace("home.html");
        } else {
          window.location.replace("login.html");
        }
      } catch (err) {
        alert("Confirmation failed: " + err.message);
      }
    });
  }

  window.resendCode = async function () {
    try {
      await Auth.resendSignUp(email);
      alert("New confirmation code sent.");
    } catch (err) {
      alert("Error resending code: " + err.message);
    }
  };
};
