window.onload = function () {
  const email = localStorage.getItem("signupEmail");
  if (!email || !window.Auth) {
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
        localStorage.removeItem("signupEmail");
        localStorage.setItem("accountCreated", "true");
        window.location.replace("logIn.html");
      } catch (err) {
        if (result) result.textContent = "Confirmation failed: " + err.message;
      }
    });
  }

  window.resendCode = async function () {
    try {
      await Auth.resendSignUp(email);
      if (result) result.textContent = "New confirmation code sent.";
    } catch (err) {
      if (result) result.textContent = "Error resending code: " + err.message;
    }
  };
};
