window.addEventListener("error", function (e) {
  console.error("Caught global error:", e.error);
});

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

  window.Auth = Auth; // Make available globally
  
  // Settings icon click handler
  document.addEventListener('DOMContentLoaded', function() {
    const settingsIcon = document.getElementById("settingsIcon");
    if (settingsIcon) {
      settingsIcon.addEventListener("click", () => {
        window.location.href = "settings.html";
      });
    }
  });
}