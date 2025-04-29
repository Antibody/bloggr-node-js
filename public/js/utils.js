// Theme handling
const themeToggleButton = document.getElementById('theme-toggle');
const sunIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM12 15c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zM1 11h3v2H1zM11 1h2v3h-2zM11 20h2v3h-2zM4.22 5.64l1.42-1.42l1.41 1.41l-1.42 1.42zM16.95 18.36l1.42-1.42l1.41 1.41l-1.42 1.42zM20 11h3v2h-3zM3.51 18.36l1.41-1.41l1.42 1.42l-1.41 1.41zM16.95 5.64l1.41-1.41l1.42 1.42l-1.41 1.41z"/></svg>`;
const moonIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon h-4 w-4 md:h-5 md:w-5"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

function applyTheme(isDark) {
    // Toggle class on <html> as well
    document.documentElement.classList.toggle('dark-mode', isDark);
   
    document.body.classList.toggle('dark-mode', isDark);
    if (themeToggleButton) {
        themeToggleButton.innerHTML = isDark ? sunIcon : moonIcon;
        themeToggleButton.setAttribute('aria-label', isDark ? 'Activate Light Mode' : 'Activate Dark Mode');
    }
    // Store preference in localStorage
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function initializeTheme() {
    // Check localStorage first
    const preferredTheme = localStorage.getItem('theme');
    let isDark;
    if (preferredTheme) {
        isDark = preferredTheme === 'dark';
    } else {
        // Fallback to system preference if no localStorage preference
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyTheme(isDark);
}

if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
        const isCurrentlyDark = document.body.classList.contains('dark-mode');
        applyTheme(!isCurrentlyDark);
    });
}

// Initialize theme on load (ensure this runs after DOM is ready)
// Moved initialization to main.js or specific page scripts after DOMContentLoaded

// Simple Notification Function (Example)
// You might replace this with a library like Notyf.js
function showNotification(message, type = 'info', duration = 5000) {
    console.log(`🔥 🔥🔥 🔥 🔥 🔥 🔥 🔥  Notification (${type}): ${message}`);

    // Create notification container if needed
    let notificationArea = document.getElementById('notification-area');
    if (!notificationArea) {
        notificationArea = document.createElement('div');
        notificationArea.id = 'notification-area';

        //  ABSOLUTE FIX: add as high-priority style string
        Object.assign(notificationArea.style, {
            all: 'unset', // clear every inherited style
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: '99999',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.5rem',
            pointerEvents: 'none'
          });

        document.body.appendChild(notificationArea);
    }

    // Create the notification card
    const notification = document.createElement('div');
    notification.textContent = message;

    // Pick background color
    const bg =
        type === 'success' ? '#28a745' :
        type === 'error' ? '#dc3545' :
        '#17a2b8';

    //  FORCE STYLE OVERRIDE
    notification.style.cssText = `
        background-color: ${bg} !important;
        color: white !important;
        padding: 1rem 1.25rem !important;
        border-radius: 0.5rem !important;
        min-width: 250px !important;
        max-width: 320px !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2) !important;
        font-size: 0.9rem !important;
        font-weight: 500 !important;
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity 0.4s ease, transform 0.4s ease !important;
        pointer-events: auto !important;
    `;

    notificationArea.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });

    // Auto remove
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        setTimeout(() => notification.remove(), 400);
    }, duration);
}




// API Fetch Wrapper (Example)
async function apiFetch(url, options = {}) {
    // Ensure headers object exists
    options.headers = options.headers || {};
    // Set default content type for POST/PUT if body exists and type not set
    if (options.body && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
    }
    // Stringify body if it's an object
    if (typeof options.body === 'object' && options.body !== null) {
        options.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, options);
        // Try to parse JSON, but handle cases where response might be empty or not JSON
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await response.json();
        } else {
            // If not JSON, maybe just return status or text? Or handle as error?
            // For now, we'll proceed assuming JSON or handle error below.
            data = { message: `Received non-JSON response (status: ${response.status})` };
        }


        if (!response.ok) {
            // Throw an error object that includes status and potential error message from API
            const error = new Error(data?.error || data?.message || `HTTP error! status: ${response.status}`);
            error.status = response.status;
            error.data = data; // Attach full data for context
            throw error;
        }
        return data;
    } catch (error) {
        console.error('API Fetch Error:', error);
        // Add a user-facing notification for fetch errors
        showNotification(`Network error or server issue: ${error.message}`, 'error');
        // Re-throw the error so calling function can handle it specifically if needed
        throw error;
    }
}
