window.onload = function () {
  const emailForm = document.getElementById("email_form");
  const resetForm = document.getElementById("reset_form");
  const result = document.getElementById("result");
  let resetEmail = "";

  if (!window.Auth) return;

  // Email form submission
  if (emailForm) {
    emailForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById('emailInput').value.trim();
      
      if (!email) {
        if (result) result.textContent = "Please enter your email address";
        return;
      }

      resetEmail = email;

      try {
        await Auth.forgotPassword(email);
        document.getElementById('emailForm').style.display = 'none';
        document.getElementById('resetForm').style.display = 'block';
        if (result) result.textContent = "Verification code sent to your email";
        if (result) result.style.color = "green";
      } catch (err) {
        if (result) result.textContent = "Error: " + err.message;
        if (result) result.style.color = "red";
      }
    });
  }

  // Reset form submission
  if (resetForm) {
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const verificationCode = document.getElementById('verificationCode').value.trim();
      const newPassword = document.getElementById('newPassword').value;
      
      if (!verificationCode || !newPassword) {
        if (result) result.textContent = "Please fill in all fields";
        return;
      }

      try {
        await Auth.forgotPasswordSubmit(resetEmail, verificationCode, newPassword);
        document.getElementById('resetForm').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
        if (result) result.textContent = "";
      } catch (err) {
        if (result) result.textContent = "Error: " + err.message;
        if (result) result.style.color = "red";
      }
    });
  }
};