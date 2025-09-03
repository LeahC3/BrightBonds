window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      const name = user?.attributes?.given_name || "Friend";
      const welcomeEl = document.getElementById("welcome_name");
      if (welcomeEl) welcomeEl.textContent = name;
      
      // Set up match form redirect based on birthdate
      const matchLink = document.getElementById("matchLink");
      if (matchLink) {
        const birthdate = user?.attributes?.birthdate;
        if (birthdate) {
          const birthYear = new Date(birthdate).getFullYear();
          const isStudent = birthYear > 1995;
          matchLink.href = isStudent ? "studentForm.html" : "seniorForm.html";
        } else {
          matchLink.href = "matchForm.html"; // fallback
        }
      }
    })
    .catch(() => {
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
};
