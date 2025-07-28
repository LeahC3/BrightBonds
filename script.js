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

const { Amplify, Auth } = window.aws_amplify;

Amplify.configure({
  Auth: {
    region: "us-east-1", // e.g. "us-east-1"
    userPoolId: "us-east-2_erpO5r38p", // e.g. "us-east-1_AbC123XYZ"
    userPoolWebClientId: "2qth4hv9mjbs5l57dc2rkughi3" // no client secret
  }
});

document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName = document.getElementById("firstName").value;
  const lastName = document.getElementById("lastName").value;
  const birthdate = document.getElementById("birthdate").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const result = await Auth.signUp({
      username: email,
      password: password,
      attributes: {
        email: email,
        given_name: firstName,
        family_name: lastName,
        birthdate: birthdate
      }
    });

    console.log("Sign-up successful:", result);
    alert("Check your email to confirm your account!");
  } catch (error) {
    console.error("Sign-up error:", error);
    alert("Error: " + error.message);
  }
});
