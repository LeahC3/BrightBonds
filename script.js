import { Amplify } from 'aws-amplify';
import awsExports from './aws-exports';
Amplify.configure(awsExports);

  const amplifyConfig = {
    Auth: {
      region: 'us-east-1', // replace with your actual region
      userPoolId: 'us-east-1_XKYkYd6ID', // replace with your actual User Pool ID
      userPoolWebClientId: 'qlnbi35jjb553dgarc2a780p9', // replace with your actual client ID
    }
  };
  AWS.Amplify.Amplify.configure(amplifyConfig);


  async function signUp() {
    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;
    const email = document.getElementById("signup-email").value;

    try {
      const { user } = await AWS.Amplify.Auth.signUp({
        username,
        password,
        attributes: { email }
      });
      document.getElementById("status").innerText = "Sign up successful. Check your email to confirm.";
    } catch (error) {
      document.getElementById("status").innerText = "Error: " + error.message;
    }
  }

  async function signIn() {
    const username = document.getElementById("signin-username").value;
    const password = document.getElementById("signin-password").value;

    try {
      const user = await AWS.Amplify.Auth.signIn(username, password);
      document.getElementById("status").innerText = "Signed in successfully as " + user.username;
    } catch (error) {
      document.getElementById("status").innerText = "Error: " + error.message;
    }
  }

  

/* Toggle between showing and hiding page menu when hamburger icon clicked*/
function togglePages() {
    const pages = document.getElementsByClassName("page");

    // if (pages[0].style.display !== "none") {
    //     for (let i = 0; i < pages.length; i++)
    //         pages[i].style.display = "none"
    // } else {
    //     for (let i = 0; i < pages.length; i++)
    //         pages[i].style.display = "flex";
    // }
    alert(pages[0].classList);
    if (pages[0].classList.contains("visible")) {
        alert("invis");
        for (let i = 0; i < pages.length; i++)
          pages[i].classList.remove('visible');
          pages[i].addEventListener('transitionend', function handler() {
          pages[i].style.display = "none";
          pages[i].removeEventListener('transitionend', handler);
          });
    } else {
        for (let i = 0; i < pages.length; i++)
          pages[i].style.display = "flex";
          pages[i].classList.add("visible");
          alert("visible");
        alert("added");
    }
  }

// document.addEventListener("DOMContentLoaded", function () {
//   const signupForm = document.getElementById("signup_form");
//   if (signupForm) {
//     signupForm.addEventListener("submit", async function (e) {
//       e.preventDefault(); // Stop the form from reloading the page

//       const formData = new FormData(signupForm);
//       const data = Object.fromEntries(formData.entries());

//       // Optional: Check password match
//       if (data.password !== data.confirm_password) {
//         alert("Passwords do not match!");
//         return;
//       }

//       try {
//         const response = await fetch("https://8fulahgtxb.execute-api.us-east-2.amazonaws.com/beta/", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json"
//           },
//           body: JSON.stringify(data)
//         });

//         const result = await response.json();
//         alert(result.message || "Form submitted!");
//       } catch (err) {
//         console.error("Error submitting form:", err);
//         alert("There was a problem submitting the form.");
//       }
//     });
//   }
// });
