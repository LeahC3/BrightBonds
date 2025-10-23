// CSRF Protection Utility
let csrfToken = null;

async function getCSRFToken() {
  if (!csrfToken) {
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      csrfToken = data.token;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
    }
  }
  return csrfToken;
}

function addCSRFHeaders(headers = {}) {
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}

// Enhanced fetch with CSRF protection
async function secureFetch(url, options = {}) {
  await getCSRFToken();
  
  if (options.method && options.method !== 'GET') {
    options.headers = addCSRFHeaders(options.headers || {});
  }
  
  return fetch(url, options);
}