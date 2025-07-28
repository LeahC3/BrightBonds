/* Toggle between showing and hiding page menu when hamburger icon clicked*/
function togglePages() {
    const pages = document.getElementsByClassName("page");
    
    if (pages[0].style.fontSize !== "1.1rem") {
        for (let i = 0; i < pages.length; i++)
            pages[i].style.padding = "0.6rem 1.5rem";
        
        for (let i = 0; i < pages.length; i++)
            pages[i].style.fontSize = "1.1rem";
    } else {
        for (let i = 0; i < pages.length; i++)
            pages[i].style.padding = "0rem";
        
        for (let i = 0; i < pages.length; i++)
            pages[i].style.fontSize = "0rem";
    }

  }

document.addEventListener("DOMContentLoaded", function () {
  const signupForm = document.getElementById("signup_form");
  if (signupForm) {
    signupForm.addEventListener("submit", async function (e) {
      e.preventDefault(); // Stop the form from reloading the page

      const formData = new FormData(signupForm);
      const data = Object.fromEntries(formData.entries());

      // Optional: Check password match
      if (data.password !== data.confirm_password) {
        alert("Passwords do not match!");
        return;
      }

      try {
        const response = await fetch("https://8fulahgtxb.execute-api.us-east-2.amazonaws.com/beta/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();
        alert(result.message || "Form submitted!");
      } catch (err) {
        console.error("Error submitting form:", err);
        alert("There was a problem submitting the form.");
      }
    });
  }
});