window.onload = function () {
  console.log("Script loaded:", window.location.pathname);

  // Set up Amplify
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

  // Sign-up page logic
  if (path.endsWith("signUp.html")) {
    window.signUp = async function (event) {
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
        window.location.replace("verify.html");
      } catch (err) {
        alert("Error: " + err.message);
      }
    };
  }

// Verification page logic
if (path.endsWith("verify.html")) {
  const email = localStorage.getItem("signupEmail");

  // Block access if no email is stored
  if (!email) {
    alert("Access denied. Please sign up first.");
    window.location.replace("login.html");
    return;
  }

  // check if user is confirmed or not
  Auth.signIn(email, "fake-password")
    .then(() => {
      // If this succeeds, user is already confirmed (which is weird since password is wrong)
      alert("This account is already confirmed. Please log in.");
      window.location.replace("login.html");
    })
    .catch(err => {
      if (err.code === "UserNotConfirmedException") {
        // They still need to verify
        document.getElementById("email_text").textContent = email;

        const form = document.getElementById("verify_form");
        if (form) {
          form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const code = document.getElementById("verify_code").value.trim();

            try {
              await Auth.confirmSignUp(email, code);
              alert("User confirmed successfully!");
              localStorage.removeItem("signupEmail");
              window.location.replace("signUp.html");
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
      } else if (err.code === "NotAuthorizedException") {
        // Password was wrong but user IS confirmed
        alert("This account is already confirmed. Please log in.");
        window.location.replace("login.html");
      } else if (err.code === "UserNotFoundException") {
        alert("This user does not exist. Please sign up first.");
        window.location.replace("signUp.html");
      } else {
        console.log("Unexpected error:", err);
        alert("Something went wrong. Please try again.");
        window.location.replace("login.html");
      }
    });

}

  // Sign-in page logic
  if (path.endsWith("login.html")) {
    window.signIn = async function (event) {
      event.preventDefault();
      const email = document.getElementById("email_input").value;
      const password = document.getElementById("pw_input").value;

      try {
        const user = await Auth.signIn(email, password);
        // redirect to home or dashboard
        window.location.replace("home.html");
        
      } catch (err) {
        alert("Error: " + err.message);
      }
    };
  }

  if (path.endsWith("home.html")) {
  // Check if user is signed in
  Auth.currentAuthenticatedUser()
    .then(async user => {
      const userInfo = await Auth.currentUserInfo();
      const name = userInfo?.attributes?.given_name || "Friend";

      document.getElementById("welcome_name").textContent = name;
    })
    .catch(err => {
      // Not signed in → redirect to login
      console.log("Not authenticated:", err);
      window.location.replace("login.html");
    });

  // Optional: sign-out button
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


/* Toggle between showing and hiding page menu when hamburger icon clicked*/
function togglePages() {
    alert("click");
    const menu = document.getElementById("menu");
    if (menu.classList.contains("visible")) {
      menu.classList.remove('visible');
      menu.addEventListener('transitionend', () => {
        menu.style.opacity = 0;
    }, { once: true }); // Use { once: true } to automatically remove the listener after it fires
    } else {
      menu.style.opacity = 1;
      menu.classList.add("visible");
    }
}