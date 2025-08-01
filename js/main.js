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
}

// hamburger menu function on mobile
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
