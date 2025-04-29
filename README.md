# COMING SOON


# Bloggr - Node.js & Supabase Blogging Platform

## Overview

Welcome to Bloggr! This application is a self-contained blogging platform built with Node.js and Express for the backend, serving a static HTML/CSS/JavaScript frontend. It leverages [Supabase](https://supabase.com/) for its database (PostgreSQL), user authentication (for the admin), and image storage.

Bloggr provides a secure admin interface for content creators to manage blog posts, and a fast, SEO-friendly public blog for readers.

## Setup TL;DR

For those familiar with Node.js and Supabase, here's the quick setup guide:

1.  **Supabase Project:** Create a Supabase project.
2.  **Environment Variables:** Add your Supabase Project URL and Anon Key to
`.env` but better a record in your hosting platform:
    ```plaintext
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    ```
3.  **Admin User:** In Supabase `Auth > Users`, add an admin user with an email and password.  Add this email to your environment variables as:
```plaintext
    ADMIN_ALLOWED_EMAI=your-admin-email@example.com
```
4.  **Storage Bucket:** If you plan to add images to your posts, create a **public** Supabase Storage bucket named exactly `blog-images`. Ensure **public read** access policies are set up (otherwise the images will not be visible). 
5.  **Database Table:** The `blog_posts` table  will be created automatically on first admin login via `/blog/api/validate`. Ensure RLS is enabled and policies allow public read (`SELECT`) and authenticated write (`INSERT`, `UPDATE`, `DELETE`).
6.  **Install & Run:** `npm install` then `npm run dev`.
7.  **Login:** Access `/blog/login` with the admin credentials created in step 2.

## Features

### Public Blog View

*   **Blog Index (`/blog`):** Server-Side Rendered (SSR) paginated list of published blog posts (newest first) with titles, snippets, and publication dates.
*   **Individual Post View (`/blog/:slug`):** SSR individual blog post pages with full content and SEO metadata.
*   **SEO Friendly:** Path-based URLs (`/blog/your-post-slug`) and SEO meta tags (title, description, keywords) for individual posts.
*   **"Read More/Read Less" Functionality:** Client-side JavaScript for "Read More/Read Less".

### Admin Area (`/blog/admin`)

*   **Secure Login (`/blog/login`):** JWT-protected Supabase Auth admin login, restricted to a designated email.
*   **Post Management (CRUD):**
    *   **Create:** Rich Markdown editor for writing new posts.
    *   **Read:** List of all posts in the admin dashboard.
    *   **Update:** Edit existing posts, including SEO fields and publication date.
    *   **Delete:** Remove blog posts.
*   **Markdown Editor (EasyMDE):** User-friendly Markdown editor for post content.
*   **Image Upload:** Direct image uploads to Supabase Storage (you need to create a bucket in Supabase for it), integrated into the editor.
*   **SEO Fields:** Dedicated fields for setting post-specific SEO keywords and descriptions.
*   **Date Control:** Schedule post publication with date and time settings.
*   **User Feedback:** Toastify notifications for user actions and errors.

## App Logic and Mechanics (Internal Architecture)

Bloggr follows a layered architecture:

*   **Frontend (Public Directory):**
    *   **Static HTML (`public/*.html`):**  Basic HTML structure for initial page load. Templates (`admin.html`, `login.html`, `index.html`) provide the static structure. 
    *   **SSR (`views` folder):** Note that blog index (`blog.ejs`) and individual blogposts (`post.ejs`) are rendered server-side .
    *   **CSS (`public/css/*.css`):** Styling using CSS, with theme support (light/dark mode via `initializeTheme();`  from `utils.js`).
    *   **JavaScript (`public/js/*.js`):**
        *   `utils.js`:  Utility functions like theme initialization, user notifications, and API fetch wrapper (`apiFetch`).
        *   `admin.js`:  JavaScript for the admin dashboard, handling post creation, editing, deletion, and image uploads via API calls (see below).
        *   `login.js`, `main.js`:  Resposible for login form logic and newsletter signup logic, respectively. 
*   **Backend (Root Directory):**
    *   **Node.js with Express (`server.mjs`):**  Handles server-side logic, routing the API endpoints from `routes/api.js`.
    *   **API Routes (`routes/api.js`):** Defines REST API endpoints for:
        1.    **Fetching blog posts** (`/api/posts`, `/api/admin/posts`, `/api/posts/:slug`, `/api/post-content/:slug`). 
        *  `/api/posts` - fetching blog posts (paginated, 10 per page); 
        *  `/api/admin/posts` - fetching all blog posts (unlike `/api/posts`) **without** pagination for Admin dashboard; 
        *  `/api/posts/:slug`- this endpoint retrieves a single blog post with SEO tahs based on its slug e.g. /blog/my-first-post; 
        *  `/api/post-content/:slug`- this endpoint is similar to /api/posts/:slug, but it retrieves only the content of a single blog post.
        2.   **Admin post management** (`/api/create-post`, `/api/posts/:slug` (PUT, DELETE)).
        3.   **Image uploads** (`/api/upload-image`).
        4.   **User authentication** (`/api/login`).
        5.   **Newsletter signup functionality** (`/api/waitlist`, `/api/rank`).
    *   **EJS Templates (`views/*.ejs`):** Used for Server-Side Rendering of the blog index and individual post pages, dynamically injecting blog post data into HTML templates.
    *   **Supabase Integration (`lib/*.js`):**
        *   `lib/supabaseClient.js`:  Initializes and exports Supabase client instances for both browser-side (anonymous key) and server-side (service role key) operations.
    *   **Configuration (`.env`, `package.json`, `postcss.config.mjs`):**
        *   `.env`: Stores environment variables (Supabase keys, JWT secret, etc.).
        *   `package.json`:  Defines project dependencies and scripts (run commands).
        *   `postcss.config.mjs`: Configuration for CSS postprocessing (Tailwind CSS).

### Data Flow - Public Blog (Server-Side Rendering)

1.  **Request to `/blog` or `/blog/:slug`:** A user or crawler requests the blog index or a specific blog post.
2.  **Server-Side Data Fetching (`server.mjs`):**
    *   Express route handler in `server.mjs` for `/blog` or `/blog/:slug` is triggered.
    *   The handler uses `getSupabaseServerClient()` to get a Supabase server client.
    *   It fetches blog post data from the Supabase database using the server client (e.g., paginated list for `/blog`, single post for `/blog/:slug`).
3.  **EJS Template Rendering (`views/*.ejs`):**
    *   The route handler selects the appropriate EJS template (`views/blog.ejs` or `views/post.ejs`).
    *   It passes the fetched blog post data to the `res.render()` function, along with any necessary variables (e.g., `totalPages`, `currentPage` for pagination).
    *   EJS engine processes the template, injecting the data into placeholders (`<%= ... %>`, `<%- ... %>`) to generate the final HTML string.
4.  **HTML Response:** Express sends the fully rendered HTML page as the response to the user's browser. The browser displays the blog content immediately, without needing to execute JavaScript for the initial render.

### Data Flow - Admin Actions (API Interactions)

1.  **Admin Interface Interaction (`public/js/admin.js`):**
    *   User interacts with the admin dashboard (e.g., clicks "Save Post", "Delete Post", "Upload Image").
    *   `public/js/admin.js` functions (e.g., `savePost`, `deletePost`, `uploadImage`) are triggered.
    *   These functions use `apiFetch` (from `utils.js`) to make asynchronous requests to the backend API endpoints defined in `routes/api.js`.
2.  **API Endpoint Handling (`routes/api.js`):**
    *   API routes in `routes/api.js` (e.g., `POST /api/create-post`, `DELETE /api/admin/posts/:slug`) receive the requests.
    *   They use `getSupabaseServerClient()` to get a Supabase server client.
    *   They interact with the Supabase database (or Storage) to perform the requested operations (insert, update, delete posts, upload images, authenticate admin users).
3.  **Database and Storage Operations (Supabase):**
    *   Supabase handles database queries, data storage, user authentication, and storage bucket operations based on the API requests.
    *   Row Level Security (RLS) policies in Supabase control access to data, ensuring only authorized users (admin) can modify blog posts.
4.  **API Response:**
    *   API endpoints send JSON responses back to the client (`public/js/admin.js`) indicating success or failure of the operation, often including data or error messages.
5.  **Client-Side Feedback (`public/js/admin.js`):**
    *   `public/js/admin.js` handles the API responses.
    *   It uses `showNotification` (from `utils.js`) to display user-friendly messages (toasts) to indicate success or errors (e.g., "Post created successfully", "Failed to upload image").
    *   It updates the admin dashboard UI as needed (e.g., refreshing the post list after creating or deleting a post).

This separation ensures a clear flow of data and responsibilities: the server handles data fetching and initial rendering for SEO and performance, while client-side JavaScript enhances interactivity and manages admin actions through API calls.


## Getting Started: Setting Up Your Blog

Follow these steps to get the blog running on your own computer or deploy it online.

### Prerequisites

1.  **Node.js:** You need Node.js installed on your computer. You can download it from [nodejs.org](https://nodejs.org/). The `npm` (Node Package Manager) is included with Node.js.
2.  **Code:** You need the codebase for this project. If you haven't already, clone or download it.
3.  **Terminal/Command Prompt:** You'll need to run commands in a terminal window.

### Step 1: Install Dependencies

Navigate to the main project directory (the one containing `package.json`) in your terminal and run:

```bash
npm install
```

This command downloads and installs all the necessary software packages the project relies on.

### Step 2: Set Up Supabase

Supabase provides the backend database, file storage, and authentication.

1.  **Create a Supabase Account:** Go to [supabase.com](https://supabase.com/) and sign up for a free account.
2.  **Create a New Project:** Once logged in, create a new project. Give it a name (e.g., "My Blog Project") and choose a strong database password (save this password securely!). Select a region close to you or your users.
3.  **Get API Keys:** After the project is created, navigate to **Project Settings** (the gear icon) > **API**. You will need two values from this page:
    *   **Project URL:** Looks like `https://<your-project-ref>.supabase.co`. Copy this.
    *   **anon public Key:** A long string of characters. Copy this. *Treat this key like a password - don't share it publicly in your code repository if it's public.*
4.  **Configure Authentication:**
    *   Go to **Authentication** (the user icon) in the left sidebar.
    *   Under **Providers**, ensure **Email** is enabled. You might want to disable "Confirm email" for easier local setup, but enable it for production deployment.
    *   Go to **Users** and click **Add user**. Create a user account for yourself (the administrator). Use a valid email address and a strong password. You will use these credentials to log into the `/blog/admin` area.
5.  **Set Up Storage for Images:**
    *   Go to **Storage** (the folder icon) in the left sidebar.
    *   Click **Create a new bucket**.
    *   Name the bucket exactly `blog-images`.
    *   Make the bucket **Public**. *This is important so visitors can see the images in your posts.*
    *   Click **Create Bucket**.
    *   After creation, click on the `blog-images` bucket, go to the **Policies** tab. You should see a policy allowing public read access (`SELECT`). If not, you may need to create one. A standard policy for public read access looks like this (you can usually use the template provided by Supabase):
        ```sql
        -- Policy: Allow public read access to files in blog-images bucket
        CREATE POLICY "Public Read Access" ON storage.objects
        FOR SELECT
        USING ( bucket_id = 'blog-images' );

        -- (Optional but recommended) Policy: Allow authenticated users (admin) to upload/manage images
        CREATE POLICY "Allow Admin Uploads" ON storage.objects
        FOR INSERT, UPDATE, DELETE
        TO authenticated -- Or restrict to a specific role if needed
        WITH CHECK ( bucket_id = 'blog-images' );
        ```
        *You can add SQL policies via the Supabase dashboard under Storage > Policies or Database > SQL Editor.*

6.  **Database Table (`blog_posts`):**
    *   This application is designed to **automatically create the `blog_posts` table** the first time a logged-in admin visits the `/blog/admin` page if it doesn't already exist. This happens via the `/blog/api/validate` endpoint.
    *   **Manual Creation (Alternative/Verification):** If you prefer or need to verify, you can create the table manually. Go to **Table Editor** (the table icon) > **New table**.
        *   Table Name: `blog_posts`
        *   Ensure "Enable Row Level Security (RLS)" is **checked**. *This is crucial for security.*
        *   Add the following columns:
            *   `id` (int8, Primary Key, auto-generated, default: `nextval('blog_posts_id_seq'::regclass)`) - Supabase usually sets this up automatically.
            *   `created_at` (timestamptz, default: `now()`) - Supabase usually sets this up automatically.
            *   `slug` (text, **Is Unique**) - This is the URL-friendly identifier for the post (e.g., `my-first-post`).
            *   `title` (text) - The main title of the blog post.
            *   `content` (text) - The main body of the post, stored as HTML.
            *   `published_at` (timestamptz) - The date and time the post is considered published.
            *   `description` (text, **Is Nullable**) - The short description for SEO.
            *   `keywords` (text, **Is Nullable**) - Comma-separated keywords for SEO.
    *   **Row Level Security (RLS) Policies:** For security, you need RLS policies. Go to **Authentication** > **Policies**. Select the `blog_posts` table.
        *   **Enable RLS** if it's not already enabled.
        *   Create policies:
            *   **Allow public read access:** Create a policy `FOR SELECT` `USING (true)`. This lets anyone read blog posts.
            *   **Allow admin full access:** Create policies `FOR INSERT`, `FOR UPDATE`, `FOR DELETE` `TO authenticated` (or a specific admin role if you set one up). This lets logged-in users manage posts. You can use the templates provided by Supabase.

### Step 3: Configure the Application

1.  **Create `.env.local` file:** In the main project root directory (the same level as `package.json`), create a file named `.env.local`.
2.  **Add Supabase Keys:** Add the Supabase URL and Anon Key you copied earlier to this file:

    ```plaintext
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

    # Optional: Add if you want the Vercel rebuild trigger to work
    # VERCEL_DEPLOY_HOOK_URL=YOUR_VERCEL_DEPLOY_HOOK_URL
    ```

    Replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY` with the actual values from your Supabase project settings.

### Step 4: Run the Application Locally

1.  Open your terminal in the project root directory.
2.  Run the command:
    ```bash
    npm run dev
    ```
3.  Open your web browser and go to `http://localhost:3000`.
4.  Navigate to `/blog/login` and log in using the admin email and password you created in Supabase Auth.
5.  Navigate to `/blog/admin`. The first time you visit, it should check for and potentially create the `blog_posts` table. You can now start creating posts!
6.  Navigate to `/blog` to see the public view of your posts.

## Using the Admin Area (`/blog/admin`)

Once logged in, the admin area is split into two main sections:

*   **Left Column (Manage Posts):**
    *   Lists all your existing blog posts.
    *   Shows the title, slug (URL part), and publication date for each.
    *   Provides "Edit" and "Delete" buttons for each post.
*   **Right Column (Editor):**
    *   **Creating a New Post:** This section is ready for a new post by default.
    *   **Editing an Existing Post:** Click the "Edit" button next to a post in the left column. The right column will load that post's details.
    *   **Fields:**
        *   **Title:** The main title of your post.
        *   **Date:** Set the publication date and time (uses your local timezone for input but saves as universal time UTC).
        *   **SEO Keywords:** Enter relevant keywords separated by commas (e.g., `nextjs, supabase, blog, tutorial`).
        *   **SEO Description:** Write a short summary (around 160 characters) for search engines.
        *   **Content Editor:** Use the toolbar buttons (Bold, Italic, Underline, Headings H2/H3, Paragraph) to format your text. Click "Upload Image" to add images.
    *   **Buttons:**
        *   **Save Post / Update Post:** Saves your changes to Supabase.
        *   **Cancel Edit:** (Appears when editing) Discards changes and resets the editor form.
        *   **Clear Editor:** (Appears when creating) Clears the content editor area.

## Deployment

To make your blog accessible to everyone online, you need to deploy it.

1.  **Choose a Host:** Select a hosting provider that supports Next.js. [Vercel](https://vercel.com/) is highly recommended as it's made by the creators of Next.js and integrates well (like the optional rebuild trigger). Other options include Netlify, AWS Amplify, etc.
2.  **Connect Repository:** Link your code repository (e.g., GitHub, GitLab) to your chosen hosting provider.
3.  **Configure Build Settings:** The host usually detects Next.js automatically. Ensure the build command is `npm run build`.
4.  **Environment Variables:** Add your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the hosting provider's environment variable settings. **Important:** If you created separate Supabase projects for development and production, use the **production** keys here. Also add the `VERCEL_DEPLOY_HOOK_URL` if you want the rebuild trigger feature.
5.  **Deploy:** Trigger the deployment process through the hosting provider's interface.
6.  **Access:** Your blog will be live at the URL provided by your host (or your custom domain if you set one up).

## Key API Endpoints

These are the backend routes that the admin interface uses to interact with Supabase:

*   `/blog/api/validate`: Checks if the user is logged in as an admin and ensures the `blog_posts` table exists (creates it if not).
*   `/api/admin/posts`: Gets the list of all posts for the admin view.
*   `/api/admin/create-post`: Creates a new blog post.
*   `/api/admin/posts/[slug]`: Gets, updates (PUT), or deletes (DELETE) a specific post identified by its `slug`.
*   `/api/admin/upload-image`: Handles image uploads to Supabase Storage.


Enjoy blogging!

