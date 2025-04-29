
// js/newsletter-admin.js
document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    // Removed manual theme switcher element (handled by utils.js)
    const logoutButton = document.getElementById('logout-button');
    const currentLaunchDateSpan = document.getElementById('current-launch-date');
    const messageLaunchDateSpan = document.getElementById('message-launch-date');
    const datePickerInput = document.getElementById('date-picker');
    const timePickerInput = document.getElementById('time-picker');
    const senderNameInput = document.getElementById('senderName');
    const subjectInput = document.getElementById('subject');
    const messageTextarea = document.getElementById('message');
    const sendRemindersButton = document.getElementById('send-reminders-button');
    const downloadCsvButton = document.getElementById('download-csv-button');
    const deleteWaitlistButton = document.getElementById('delete-waitlist-button');
    const toggleRemindersButton = document.getElementById('toggle-reminders-button');
    const reminderFlagStatusSpan = document.getElementById('reminder-flag-status');
    const successNotificationArea = document.getElementById('notification-area-success') || document.getElementById('notification-area');
    const successNotificationMessageSpan = document.getElementById('notification-message-success') || document.getElementById('notification-message');
    const errorNotificationArea = document.getElementById('notification-area-error') || document.getElementById('notification-area');
    const errorNotificationMessageSpan = document.getElementById('notification-message-error') || document.getElementById('notification-message');
    const body = document.body;

    let currentLaunchDateISO = null; 
    let datePickerInstance = null;
    let timePickerInstance = null;
    let successNotificationTimeout;
    let errorNotificationTimeout;

    // ───────────────────────────────────────────────────────────────
    // Utility Functions
    // ───────────────────────────────────────────────────────────────

    function showLoadingDots(button, show) {
        const dots = button.querySelector('.loading-dots-container');
        if (dots) {
            dots.style.display = show ? 'inline-block' : 'none';
        }
        button.disabled = show;
    }

    function showNotification(message, type = 'info', duration = 5000) {
        let notificationElement;
        let messageSpan;
        let timeoutRef;
        let timeoutStore;

        if (type === 'success') {
            notificationElement = successNotificationArea;
            messageSpan = successNotificationMessageSpan;
            timeoutRef = successNotificationTimeout;
            timeoutStore = (timeoutId) => { successNotificationTimeout = timeoutId; };
        } else if (type === 'error') {
            notificationElement = errorNotificationArea;
            messageSpan = errorNotificationMessageSpan;
            timeoutRef = errorNotificationTimeout;
            timeoutStore = (timeoutId) => { errorNotificationTimeout = timeoutId; };
        } else {
            notificationElement = successNotificationArea;
            messageSpan = successNotificationMessageSpan;
            timeoutRef = successNotificationTimeout;
            timeoutStore = (timeoutId) => { successNotificationTimeout = timeoutId; };
        }

        if (!notificationElement || !messageSpan) {
            console.error("Notification elements not found for type:", type);
            return; 
        }
        
        if (timeoutRef) clearTimeout(timeoutRef);

        messageSpan.textContent = message;
        notificationElement.className = 'notification';
        notificationElement.classList.add(type, 'show');
        notificationElement.style.display = 'block';

        const currentTimeout = setTimeout(() => {
            notificationElement.classList.remove('show');
            setTimeout(() => { 
                if ((type === 'success' && successNotificationTimeout === currentTimeout) || 
                    (type === 'error' && errorNotificationTimeout === currentTimeout) ||
                    (type !== 'success' && successNotificationTimeout === currentTimeout)) {
                    notificationElement.style.display = 'none'; 
                }
            }, 500);
            timeoutStore(null);
        }, duration);

        timeoutStore(currentTimeout);
    }

    function initializePickers(initialDate) {
        if (datePickerInstance) datePickerInstance.destroy();
        if (timePickerInstance) timePickerInstance.destroy();

        datePickerInstance = flatpickr(datePickerInput, {
            dateFormat: "Y-m-d",
            defaultDate: initialDate,
            onChange: function(selectedDates) {
                const timeSelected = timePickerInstance ? timePickerInstance.selectedDates[0] : null;
                if (!selectedDates.length) return;
                const combinedDate = new Date(selectedDates[0]);
                if (timeSelected) {
                    combinedDate.setHours(timeSelected.getHours(), timeSelected.getMinutes(), 0, 0);
                } else {
                    const defaultTime = initialDate || new Date();
                    combinedDate.setHours(defaultTime.getHours(), defaultTime.getMinutes(), 0, 0); 
                    if (timePickerInstance) {
                        timePickerInstance.setDate(combinedDate, false); 
                    }
                }
                updateLaunchDate(combinedDate);
            }
        });

        timePickerInstance = flatpickr(timePickerInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            defaultDate: initialDate,
            minuteIncrement: 15,
            onChange: function(selectedDates) {
                const dateSelected = datePickerInstance ? datePickerInstance.selectedDates[0] : null;
                if (!selectedDates.length) return;
                if (dateSelected) {
                    const combinedDate = new Date(dateSelected);
                    combinedDate.setHours(selectedDates[0].getHours(), selectedDates[0].getMinutes(), 0, 0);
                    updateLaunchDate(combinedDate);
                } else {
                    showNotification("Please select a date first.", "info");
                    this.clear(); 
                }
            }
        });
    }

    async function updateLaunchDate(dateObject) {
        if (!dateObject) return;
        const isoDateString = dateObject.toISOString();
        console.log("Updating launch date to:", isoDateString);
        try {
            const response = await fetch('/api/set-launch-date', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ launchDate: isoDateString }),
                credentials: 'include'
            });
            if (!response.ok) {
                if (response.status === 401) {
                    showNotification('Session expired. Please log in again.', 'error');
                    window.location.href = '/login.html';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to set launch date (Status: ${response.status})`);
            }
            currentLaunchDateISO = isoDateString;
            currentLaunchDateSpan.textContent = currentLaunchDateISO;
            messageLaunchDateSpan.textContent = currentLaunchDateISO;
            showNotification('Launch date updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating launch date:', error);
            showNotification(`Error: ${error.message}`, 'error');
            initializePickers(currentLaunchDateISO ? new Date(currentLaunchDateISO) : null);
        }
    }

    // ───────────────────────────────────────────────────────────────
    // Logout Functionality
    // ───────────────────────────────────────────────────────────────

    logoutButton.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
            if (res.ok) {
                window.location.href = '/login.html';
            } else {
                let errorMsg;
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const data = await res.json();
                    errorMsg = data.error || data.message || 'Logout failed';
                } else {
                    errorMsg = await res.text(); // handle plain-text error
                }
                showNotification(`Logout failed: ${errorMsg}`, 'error');
            }
        } catch (err) {
            showNotification(`Network error: ${err.message}`, 'error');
        }
    });

    // ───────────────────────────────────────────────────────────────
    // Send Reminder Emails
    // ───────────────────────────────────────────────────────────────

    sendRemindersButton.addEventListener('click', async () => {
        const sender = senderNameInput.value.trim();
        const subj = subjectInput.value.trim();
        const msg = messageTextarea.value.trim();
        if (!sender || !subj || !msg) {
            showNotification("Please fill in Sender Name, Subject, and Message.", "error");
            return;
        }
        showLoadingDots(sendRemindersButton, true);
        try {
            const response = await fetch('/api/waitlist-reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: sender, subject: subj, text: msg }),
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok && response.status !== 200) {
                if (response.status === 401) {
                    showNotification('Session expired. Please log in again.', 'error');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(data.error || data.message || `Failed to send reminders (Status: ${response.status})`);
            } else {
                const successMessage = data.successCount > 0 
                    ? `Successfully queued ${data.successCount} emails.` 
                    : (data.hadErrors ? 'No emails were successfully sent.' : (data.message || 'Operation completed.'));
                showNotification(successMessage, 'success', 10000);
                console.log(successMessage);

                if (data.hadErrors && data.errorCount > 0) {
                    const failedEmailList = data.failedEmails && Array.isArray(data.failedEmails) && data.failedEmails.length > 0 
                        ? ` Failed emails: ${data.failedEmails.map(item => item.email).join(', ')}` : '';
                    const errorMessage = `Failed to send ${data.errorCount} emails.${failedEmailList}`;
                    console.error(errorMessage, data.failedEmails);
                    setTimeout(() => {
                        if (errorNotificationArea === successNotificationArea) {
                            const errorDiv = document.createElement('div');
                            errorDiv.classList.add('notification', 'error', 'show');
                            errorDiv.textContent = errorMessage;
                            errorDiv.style.marginTop = '4rem';
                            successNotificationArea.parentNode.insertBefore(errorDiv, successNotificationArea.nextSibling);
                            setTimeout(() => {
                                errorDiv.classList.remove('show');
                                setTimeout(() => errorDiv.remove(), 500);
                            }, 10000);
                        } else {
                            showNotification(errorMessage, 'error', 10000);
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error sending reminders:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            showLoadingDots(sendRemindersButton, false);
        }
    });

    // ───────────────────────────────────────────────────────────────
    // Download Waitlist as CSV
    // ───────────────────────────────────────────────────────────────

    downloadCsvButton.addEventListener('click', async () => {
        showLoadingDots(downloadCsvButton, true);
        try {
            const response = await fetch('/api/get-all-waitlist', { credentials: 'include' });
            if (!response.ok) {
                if (response.status === 401) {
                    showNotification('Session expired. Please log in again.', 'error');
                    window.location.href = '/login.html';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch waitlist data (Status: ${response.status})`);
            }
            const data = await response.json();
            if (!data || data.length === 0) {
                showNotification("Waitlist is empty. Nothing to download.", "info");
                return;
            }
            const headers = Object.keys(data[0]);
            const csvRows = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(header => {
                        let val = row[header] == null ? '' : String(row[header]);
                        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                            val = `"${val.replace(/"/g, '""')}"`;
                        }
                        return val;
                    }).join(',')
                )
            ];
            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', 'waitlist.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading CSV:', error);
            showNotification(`Error downloading CSV: ${error.message}`, 'error');
        } finally {
            showLoadingDots(downloadCsvButton, false);
        }
    });

    // ───────────────────────────────────────────────────────────────
    // Delete All Waitlist Entries (Danger Zone)
    // ───────────────────────────────────────────────────────────────

    deleteWaitlistButton.addEventListener('click', async () => {
        const confirmation = confirm(
            "⚠️ DANGER ZONE ⚠️\n\n" +
            "This will permanently delete ALL waitlist entries.\n" +
            "There is NO undo.\n\n" +
            "Are you absolutely sure you want to proceed?"
        );
        if (!confirmation) return;
        showLoadingDots(deleteWaitlistButton, true);
        try {
            const response = await fetch('/api/clear-waitlist', {
                method: 'POST',
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) {
                if (response.status === 401) {
                    showNotification('Session expired. Please log in again.', 'error');
                    window.location.href = '/login.html';
                } else {
                    throw new Error(data.error || `Failed to clear waitlist (Status: ${response.status})`);
                }
            } else {
                showNotification('Waitlist cleared successfully!', 'success');
            }
        } catch (error) {
            console.error('Error clearing waitlist:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            showLoadingDots(deleteWaitlistButton, false);
        }
    });

    // ───────────────────────────────────────────────────────────────
    // Toggle Reminder Flags Button Functionality
    // ───────────────────────────────────────────────────────────────
    toggleRemindersButton.addEventListener('click', async () => {
        const confirmation = confirm("This will toggle all reminder flags (TRUE becomes FALSE and vice versa) in the newsletter database. Are you sure?");
        if (!confirmation) return;
        showLoadingDots(toggleRemindersButton, true);
        try {
            const response = await fetch('/api/toggle-reminders', {
                method: 'POST',
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Failed to toggle reminders (Status: ${response.status})`);
            } else {
                showNotification(data.message || 'Reminder flags toggled successfully!', 'success');
                const match = data.message && data.message.match(/New value:\s*(true|false)/i);
                if (match && reminderFlagStatusSpan) {
                    reminderFlagStatusSpan.textContent = match[1].toUpperCase();
                } else if (reminderFlagStatusSpan) {
                    reminderFlagStatusSpan.textContent = 'Toggled (refresh?)';
                }
            }
        } catch (error) {
            console.error('Error toggling reminder flags:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
            showLoadingDots(toggleRemindersButton, false);
        }
    });


    // ───────────────────────────────────────────────────────────────
    //  initialize theme using utils.js
    // ───────────────────────────────────────────────────────────────
    initializeTheme(); // Call initializeTheme to sync theme toggle button and apply correct theme
});
