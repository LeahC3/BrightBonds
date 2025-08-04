window.onload = function () {
  if (!window.Auth) return;

  Auth.currentAuthenticatedUser()
    .then(async user => {
      const name = user?.attributes?.given_name || "Friend";
    })
    .catch(() => {
      window.location.replace("login.html");
    });
};


document.getElementById("match_form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    if (data[key]) {
      if (Array.isArray(data[key])) data[key].push(value);
      else data[key] = [data[key], value];
    } else {
      data[key] = value;
    }
  }

  try {
    // Get current Cognito JWT token
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();

    const response = await fetch("https://1asmlb4abc.execute-api.us-east-2.amazonaws.com/default", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",  // 👈 Needed for Auth + CORS
    body: JSON.stringify(data),
  });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${await response.text()}`);
    }

    const result = await response.json();
    alert("Form submitted successfully!");
    console.log(result);
  } catch (err) {
    console.error("Form submission error:", err);
    alert("There was an error submitting the form.");
  }
});
