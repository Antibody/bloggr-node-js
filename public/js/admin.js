// Admin Dashboard Logic for /blog/admin
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();

    // Elements
    const postsList = document.getElementById('admin-posts-list');
    const postForm = document.getElementById('admin-post-form');
    const editorTitle = document.getElementById('editor-title');
    const editingSlugInput = document.getElementById('editing-slug');
    const titleInput = document.getElementById('post-title');
    const dateInput = document.getElementById('post-date');
    const seoKeywordsInput = document.getElementById('post-seo-keywords');
    const seoDescriptionInput = document.getElementById('post-seo-description');
    const contentTextarea = document.getElementById('post-content');
    const uploadImageBtn = document.getElementById('upload-image-btn');
    const imageInput = document.getElementById('image-input');
    const saveBtn = document.getElementById('save-post-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const clearEditorBtn = document.getElementById('clear-editor-btn');

    // Editor (EasyMDE)
    let easyMDE = new EasyMDE({
        element: contentTextarea,
        spellChecker: false,
        status: false,
        minHeight: "300px",
        toolbar: [
            "bold", "italic", "heading", "|",
            "quote", "unordered-list", "ordered-list", "|",
            "link", "image", "code", "table", "|",
            "preview", "side-by-side", "fullscreen", "|",
            "guide"
        ]
    });

    // Tagify for SEO keywords
    let tagify = new Tagify(seoKeywordsInput, {
        whitelist: [],
        dropdown: { enabled: 0 }
    });

    // State
    let posts = [];
    let isEditing = false;

    // Fetch and display posts
    async function fetchPosts() {
        postsList.innerHTML = '<li>Loading posts...</li>';
        try {
            const data = await apiFetch('/api/admin/posts')
      posts = data.posts || []
      renderPosts()
    } catch (err) {
      postsList.innerHTML = '<li>Error loading posts.</li>'
    }
  }

    function renderPosts() {
        postsList.innerHTML = '';
        if (!posts.length) {
            postsList.innerHTML = '<li>No posts found.</li>';
            postsList.scrollTop = 0;

            return;
        }
        posts.forEach(post => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="post-title">${post.title}</div>
                <div class="post-date">${new Date(post.date).toLocaleDateString()}</div>
                <div class="admin-actions">
                    <button class="edit-btn" data-slug="${post.slug}"><i class="fas fa-edit"></i> Edit</button>
                    <button class="delete-btn" data-slug="${post.slug}"><i class="fas fa-trash"></i> Delete</button>
                </div>
            `;
            postsList.appendChild(li);
        });

        // Attach event listeners
        postsList.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => startEditPost(btn.dataset.slug));
        });
        postsList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deletePost(btn.dataset.slug));
        });
    }

    // Start editing a post
    async function startEditPost(slug) {
        const post = posts.find(p => p.slug === slug);
        if (!post) return;
        editorTitle.textContent = `Edit Post: ${post.title}`;
        editingSlugInput.value = slug;
        titleInput.value = post.title;
        dateInput.value = formatDateForInput(post.date);
        seoKeywordsInput.value = '';
        tagify.removeAllTags();
        // Fetch full post data (with content, SEO fields)
        try {
            const data = await apiFetch(`/api/posts/${slug}`);
            easyMDE.value(data.content || '');
            seoDescriptionInput.value = data.seoDescription || '';
            if (data.seoKeywords) {
                tagify.addTags(data.seoKeywords.split(',').map(s => s.trim()).filter(Boolean));
            }
        } catch (err) {
            showNotification('Error loading post for editing.', 'error');
        }
        isEditing = true;
        cancelEditBtn.style.display = '';
        clearEditorBtn.style.display = 'none';
    }

    // Cancel editing
    cancelEditBtn.addEventListener('click', () => {
        resetForm();
    });

    // Clear editor
    clearEditorBtn.addEventListener('click', () => {
        easyMDE.value('');
        titleInput.value = '';
        dateInput.value = '';
        seoKeywordsInput.value = '';
        tagify.removeAllTags();
        seoDescriptionInput.value = '';
    });

    // Save post (create or update)
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        const originalSaveButtonText = saveBtn.innerHTML; // Store original text/HTML
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; // Set loading state

        const slug = editingSlugInput.value;
        const title = titleInput.value.trim();
        const date = dateInput.value;
        const seoKeywords = tagify.value.map(tag => tag.value).join(',');
        const seoDescription = seoDescriptionInput.value.trim();
        const content = easyMDE.value();

        if (!title || !date || !content) {
            showNotification('Title, date, and content are required.', 'error');
            saveBtn.disabled = false;
            return;
        }

        const payload = {
            title,
            htmlContent: content,
            date: new Date(date).toISOString(),
            seoKeywords,
            seoDescription
        };

        try {
            let response;
            if (slug) {
                // Update
                response = await apiFetch(`/api/posts/${slug}`, {
                    method: 'PUT',
                    body: payload
                });
                showNotification(response.message || 'Post updated!', 'success');
                resetForm();
                fetchPosts(); // still needed for updates
            } else {
                // Create
                response = await apiFetch('/api/create-post', {
                    method: 'POST',
                    body: payload
                });
        
                showNotification(response.message || 'Post created!', 'success');
                        
                // === INSERT NEW POST TO LIST WITHOUT FETCHING EVERYTHING ===
                const newPost = {
                    title,
                    slug: title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)+/g, ''),
                    date: date
                };
        
                await fetchPosts();
         // re-render post list
                resetForm();            // clear form and return to create mode
            }
        } catch (err) {
            showNotification(err.data?.error || 'Error saving post.', 'error');
        }
         finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalSaveButtonText; // Restore original text/HTML
        }
    });

    // Delete post
    async function deletePost(slug) {
        if (!confirm('Are you sure you want to delete this post?')) return;
        try {
            await apiFetch(`/api/admin/posts/${slug}`, { method: 'DELETE' });
            showNotification('Post deleted.', 'success');
            fetchPosts();
            if (editingSlugInput.value === slug) resetForm();
        } catch (err) {
            showNotification(err.data?.error || 'Error deleting post.', 'error');
        }
    }

    // Reset form to create mode
    function resetForm() {
        editorTitle.textContent = 'Create New Blog Post';
        editingSlugInput.value = '';
        titleInput.value = '';
        dateInput.value = formatDateForInput(new Date());
        seoKeywordsInput.value = '';
        tagify.removeAllTags();
        seoDescriptionInput.value = '';
        easyMDE.value('');
        isEditing = false;
        cancelEditBtn.style.display = 'none';
        clearEditorBtn.style.display = '';
    }

    // Format date for input[type=datetime-local]
    function formatDateForInput(date) {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    }

    // Image upload
    uploadImageBtn.addEventListener('click', () => {
        // Prevent triggering upload if already uploading
        if (uploadImageBtn.disabled) return;
        imageInput.click();
    });

    imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show loading state
        const originalButtonText = uploadImageBtn.innerHTML;
        // Assuming Font Awesome is available for spinner icon
        uploadImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        uploadImageBtn.disabled = true;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
                // Note: Do not set Content-Type header when sending FormData,
                // the browser sets it correctly with the boundary.
            });

            const data = await response.json();

            if (response.ok && data.success && data.imageUrl) {
                // Insert HTML image tag at cursor instead of Markdown
                const cm = easyMDE.codemirror;
                const pos = cm.getCursor();
                // Insert on a new line for better separation if cursor is not at start of line
                const lineContent = cm.getLine(pos.line);
                const prefix = (pos.ch > 0 && lineContent.trim().length > 0) ? '\n\n' : '';
                const suffix = '\n\n';
                // Insert simpler img tag without inline styles
                cm.replaceRange(`${prefix}<img src="${data.imageUrl}" alt="Uploaded Image">${suffix}`, pos);

               // Optional: auto-toggle preview for 3 seconds
                easyMDE.togglePreview(); // Show preview
                setTimeout(() => {
                    if (easyMDE.isPreviewActive()) {
                        easyMDE.togglePreview(); // Return to edit mode
                    }
                }, 3000);

                showNotification('Image uploaded and inserted!', 'success');
            } else {
                // Use error message from API response if available
                showNotification(data.error || `Image upload failed (status: ${response.status})`, 'error');
            }
        } catch (err) {
            console.error("Image upload fetch error:", err);
            showNotification('Image upload failed due to a network or server error.', 'error');
        } finally {
            // Restore button state
            uploadImageBtn.innerHTML = originalButtonText;
            uploadImageBtn.disabled = false;
            // Clear the file input value to allow uploading the same file again if needed
            imageInput.value = '';
        }
    });

    // Notification helper (Toastify)
/*     function showNotification(message, type = 'info', duration = 4000) {
        Toastify({
            text: message,
            duration: duration,
            gravity: "top",
            position: "right",
            className: "custom-notification",
            backgroundColor: type === 'success' ? "#28a745"
                : type === 'error' ? "#dc3545"
                : "#17a2b8"
        }).showToast();
    } */

    // Initial load
    resetForm();
    fetchPosts();
});
