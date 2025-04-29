// Import Supabase browser client credentials (if needed directly in frontend - for waitlist, not blog posts)
// import { supabaseBrowserCredentials } from './lib/supabaseClient'; // Not directly usable in vanilla JS like this

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme(); // Initialize theme from utils.js

    const waitlistForm = document.getElementById('waitlist-form');
    const emailInput = document.getElementById('email');
    const submitButton = document.getElementById('waitlist-submit-button');
    const signupNumberPanel = document.getElementById('signup-number-panel');
    const signupNumberDisplay = document.getElementById('signup-number');
    const loader = document.querySelector('.loader');


    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            const email = emailInput.value.trim();
            if (!email) {
                showNotification('Please enter your email address.', 'error');
                return;
            }

            setLoadingState(true); // Disable button and show loader

            try {
                const response = await apiFetch('/api/waitlist', { // Use apiFetch from utils.js
                    method: 'POST',
                    body: { email }
                });

                if (response.success) {
                    showNotification(response.message, 'success');
                    // Fetch and display rank
                    fetchRank(email);
                } else if (response.duplicate) {
                    // Handle duplicate email - inform user and fetch rank
                    showNotification('This email is already registered.', 'info');
                    fetchRank(email);
                } else {
                    // Generic error - show error message from response if available
                    showNotification(response.error || 'Signup failed.', 'error');
                }


            } catch (error) {
                // Error already handled by apiFetch (shows notification)
                console.error('Waitlist signup error:', error);
                // showNotification('An unexpected error occurred during signup.', 'error'); // Already shown by apiFetch
            } finally {
                setLoadingState(false); // Re-enable button and hide loader
            }
        });
    }

    async function fetchRank(email) {
        try {
            const rankData = await apiFetch(`/api/rank?email=${encodeURIComponent(email)}`); // Use apiFetch
            if (rankData && rankData.rank !== undefined) {
                signupNumberDisplay.textContent = rankData.rank;
                signupNumberPanel.style.display = 'block'; // Show the panel
            } else {
                showNotification('Could not fetch signup number.', 'warning'); // Or 'info'
            }
        } catch (rankError) {
            console.error('Error fetching rank:', rankError);
            showNotification('Error fetching signup number.', 'warning'); // Or 'info'
        }
    }


    function setLoadingState(isLoading) {
        submitButton.disabled = isLoading;
        loader.style.display = isLoading ? 'inline-block' : 'none';
        submitButton.textContent = isLoading ? 'Processing' : 'Join Waitlist'; // Revert text
    }


});
