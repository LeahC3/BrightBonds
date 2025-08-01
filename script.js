window.addEventListener("error", function (e) {
  console.error("Caught global error:", e.error);
});

window.onload = function () {
  console.log("Script loaded on:", window.location.pathname);

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

  const path = window.location.pathname;

  // ========== SIGN UP PAGE ==========
  if (path.endsWith("signUp.html")) {
    const form = document.getElementById("signup_form");
    if (form) {
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
          localStorage.setItem("signupPassword", password); // optionally auto-login after confirmation
          window.location.replace("verify.html");
        } catch (err) {
          alert("Error: " + err.message);
        }
      });
    } else {
      console.warn("signup_form not found.");
    }
  }

  // ========== VERIFY PAGE ==========
  if (path.endsWith("verify.html")) {
    const email = localStorage.getItem("signupEmail");

    if (!email) {
      alert("Access denied. Please sign up first.");
      window.location.replace("login.html");
      return;
    }

    // Show email on screen
    const emailText = document.getElementById("email_text");
    if (emailText) {
      emailText.textContent = email;
    }

    // Handle code submission
    const verifyForm = document.getElementById("verify_form");
    if (verifyForm) {
      verifyForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const code = document.getElementById("verify_code").value.trim();

        try {
          await Auth.confirmSignUp(email, code);
          alert("User confirmed successfully!");

          // Optionally auto-sign-in
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
  }

  // ========== LOGIN PAGE ==========
  if (path.endsWith("login.html")) {
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
  }


  // ========== HOME PAGE ==========
  if (path.endsWith("home.html")) {
    Auth.currentAuthenticatedUser()
      .then(async user => {
        const userInfo = await Auth.currentUserInfo();
        const name = userInfo?.attributes?.given_name || "Friend";
        const welcomeEl = document.getElementById("welcome_name");
        if (welcomeEl) welcomeEl.textContent = name;
      })
      .catch(err => {
        console.warn("Not signed in:", err);
        window.location.replace("login.html");
      });

    const signOutBtn = document.getElementById("signOut");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", async () => {
        try {
          await Auth.signOut();
          window.location.replace("login.html");
        } catch (err) {
          alert("Sign out error: " + err.message);
        }
      });
    }
  }
};

// ========== TOGGLE MENU FUNCTION ==========
function togglePages() {
  const menu = document.getElementById("menu");
  if (menu.classList.contains("visible")) {
    menu.classList.remove('visible');
    menu.addEventListener('transitionend', () => {
      menu.style.opacity = 0;
    }, { once: true });
  } else {
    menu.style.opacity = 1;
    menu.classList.add("visible");
  }
}
