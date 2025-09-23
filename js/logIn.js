window.onload = function () {
  const form = document.getElementById("login_form");
  const result = document.getElementById("result");

  if (!form || !window.Auth) return;

  // Check for account creation success message
  if (localStorage.getItem("accountCreated")) {
    if (result) {
      result.textContent = "Account created successfully! Please log in with your email and password.";
      result.style.color = "green";
    }
    localStorage.removeItem("accountCreated");
  }

  // Login form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email_input").value.trim();
    const password = document.getElementById("pw_input").value;

    try {
      const user = await Auth.signIn(email, password);
      if (result) result.textContent = "Login successful. Welcome " + (user.attributes?.given_name || "friend") + "!";
      window.location.replace("home.html");
    } catch (err) {
      if (err.message === "User is not confirmed.") {
        localStorage.setItem("signupEmail", email);
        localStorage.setItem("signupPassword", password);
        window.location.replace("verify.html");
      } else {
        if (result) result.textContent = "Login failed: " + err.message;
      }
    }
  });
};