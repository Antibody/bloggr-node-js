document.addEventListener('DOMContentLoaded', () => {

    const blogPostsContainer = document.getElementById('blog-posts-container');

    if (blogPostsContainer) {
        blogPostsContainer.addEventListener('click', async (e) => {
            const target = e.target;

            // --- Handle "Read More" click ---
            if (target && target.classList.contains('read-more-button')) {
                e.preventDefault();
                const readMoreButton = target;
                const articleElement = readMoreButton.closest('.blog-post-item');
                const snippetElement = articleElement.querySelector('.post-snippet');
                const fullContentContainer = articleElement.querySelector('.full-content-container');
                const slug = readMoreButton.dataset.slug; // Get slug from data attribute

                if (!articleElement || !snippetElement || !fullContentContainer || !slug) {
                    console.error('Could not find necessary elements for Read More.');
                    return;
                }

                // Prevent multiple clicks while loading
                if (readMoreButton.textContent === 'Loading...') return;

                try {
                    readMoreButton.textContent = 'Loading...';
                    readMoreButton.style.pointerEvents = 'none';

                    // Fetch full content
                    const postData = await apiFetch(`/api/post-content/${slug}`); // Assumes apiFetch exists in utils.js

                    if (postData && postData.content) {
                        // Hide snippet and read more button
                        snippetElement.style.display = 'none';
                        readMoreButton.style.display = 'none';

                        // Populate and show full content container
                        fullContentContainer.innerHTML = postData.content;
                        fullContentContainer.style.display = 'block';

                        // Create and add "Read Less" buttons
                        const readLessButtonTop = document.createElement('button');
                        readLessButtonTop.textContent = 'Read Less';
                        readLessButtonTop.classList.add('read-less-btn'); // Add class for styling & event delegation
                        readLessButtonTop.style.marginBottom = '0.5rem'; // Add some spacing

                        const readLessButtonBottom = document.createElement('button');
                        readLessButtonBottom.textContent = 'Read Less';
                        readLessButtonBottom.classList.add('read-less-btn');
                        readLessButtonBottom.style.marginTop = '0.5rem'; // Add some spacing

                        // Insert buttons relative to the full content container
                        fullContentContainer.parentNode.insertBefore(readLessButtonTop, fullContentContainer);
                        fullContentContainer.parentNode.insertBefore(readLessButtonBottom, readMoreButton); // Insert before the (hidden) read more button

                    } else {
                        throw new Error('Invalid content received');
                    }
                } catch (err) {
                    console.error('Error fetching full post content:', err);
                    showNotification('Failed to load full post.', 'error'); // Assumes showNotification exists in utils.js
                    readMoreButton.textContent = 'Read More'; // Restore original text on error
                    readMoreButton.style.pointerEvents = 'auto'; // Re-enable link
                }
            }

            // --- Handle "Read Less" click ---
            if (target && target.classList.contains('read-less-btn')) {
                e.preventDefault();
                const readLessButton = target;
                const articleElement = readLessButton.closest('.blog-post-item');
                const snippetElement = articleElement.querySelector('.post-snippet');
                const fullContentContainer = articleElement.querySelector('.full-content-container');
                const readMoreButton = articleElement.querySelector('.read-more-button');
                const allReadLessButtons = articleElement.querySelectorAll('.read-less-btn');

                if (!articleElement || !snippetElement || !fullContentContainer || !readMoreButton || !allReadLessButtons) {
                    console.error('Could not find necessary elements for Read Less.');
                    return;
                }

                // Hide full content
                fullContentContainer.style.display = 'none';
                fullContentContainer.innerHTML = ''; // Clear content

                // Remove all "Read Less" buttons within this article
                allReadLessButtons.forEach(btn => btn.remove());

                // Show snippet and "Read More" button again
                snippetElement.style.display = '';
                readMoreButton.style.display = '';
                readMoreButton.textContent = 'Read More';
                readMoreButton.style.pointerEvents = 'auto';
            }
        });
    }
});
