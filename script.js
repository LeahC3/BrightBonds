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

// const signUpButton=document.getElementById("sign_up_button")
// const signInButton=document.getElementById("sign_in_button")
// const signInForm=document.getElementById("signin_form")
// const signUpForm=document.getElementById("signup_form")

// signUpButton.addEventListener("click", function(){
//     alert("hi");
// })

// alert("run")