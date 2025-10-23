/**
 * HTML Sanitization Utility
 * Prevents XSS attacks by escaping HTML characters
 */

function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function setTextContent(element, text) {
  if (element && typeof text === 'string') {
    element.textContent = text;
  }
}

function setInnerHTML(element, html) {
  if (element && typeof html === 'string') {
    element.innerHTML = sanitizeHTML(html);
  }
}