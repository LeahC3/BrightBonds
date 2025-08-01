const AmplifyGlobal = window.aws_amplify;
if (!AmplifyGlobal) {
  alert("Amplify failed to load.");
} else {
  const { Amplify, Auth } = AmplifyGlobal;

  Amplify.configure({
    Auth: {
      region: 'us-east-2',
      userPoolId: 'us-east-2_AxTL9MRLy',
      userPoolWebClientId: '69hs07li090olcre8pg8uji24r',
    }
  });

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

  // Hook up the sign out button
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
