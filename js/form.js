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
    const response = await fetch("https://YOUR_API_ID.execute-api.us-east-2.amazonaws.com/YOUR_STAGE/submitForm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    alert("Form submitted successfully!");
    console.log(result);
  } catch (err) {
    console.error("Form submission error:", err);
    alert("There was an error submitting the form.");
  }
});
