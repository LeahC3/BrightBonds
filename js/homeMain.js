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
  
  // Settings icon click handler and mobile menu
  document.addEventListener('DOMContentLoaded', function() {
    const settingsIcon = document.getElementById("settingsIcon");
    if (settingsIcon) {
      settingsIcon.addEventListener("click", () => {
        window.location.href = "settings.html";
      });
    }
    
    // Mobile hamburger menu
    const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('nav');
    const overlay = document.getElementById('mobileOverlay');
    
    function toggleMobileMenu() {
      nav.classList.toggle('open');
      overlay.classList.toggle('show');
    }
    
    function closeMobileMenu() {
      nav.classList.remove('open');
      overlay.classList.remove('show');
    }
    
    if (hamburger && nav && overlay) {
      hamburger.addEventListener('click', toggleMobileMenu);
      overlay.addEventListener('click', closeMobileMenu);
      
      // Close menu when clicking nav links
      const navLinks = nav.querySelectorAll('.page');
      navLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
      });
    }
  });
}