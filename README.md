# Bloggr - Node.js-based Blogging Platform with Newsletter Functionality

![Bloggr - Node.js Admin Dashboard](https://github.com/user-attachments/assets/47fdce14-177d-4e64-aef4-d10e9e19f1fb)

🔗 Repo for Next.js version: https://github.com/Antibody/bloggr
💻 Blog: https://bloggr.dev/blog

## Overview

Welcome to Bloggr! This application is a self-contained blogging platform built with Node.js and Express for the backend, serving a static HTML/CSS/JavaScript frontend. It leverages [Supabase](https://supabase.com/) for its database (PostgreSQL), user authentication (for the admin), and image storage. **Additionally, it includes a waitlist and newsletter signup and sending capability.**

Bloggr provides a secure admin interface for content creators to manage blog posts **and the waitlist**, and a fast, SEO-friendly public blog for readers **with a waitlist signup form**.

## Setup TL;DR

For those familiar with Node.js, Supabase, and Resend, here's the quick setup guide:

1.  **Supabase Project:** Create a Supabase project.
2.  **Resend Account:** Create a Resend account and verify a sender email.
3.  **Environment Variables:** Configure **all** required environment variables (Supabase, Resend, Admin, Server, Telemetry) in a `.env` file for local development or directly on your hosting platform for production. See "⚠️ CRITICAL SETUP INSTRUCTIONS ⚠️" and "Environment Variables" sections for details.
4.  **Admin User in Supabase Auth:** In Supabase `Auth > Users`, add an admin user with an email and password that matches your `ADMIN_ALLOWED_EMAIL` environment variable.
5.  **Storage Bucket:** If you plan to add images to your posts, create a **public** Supabase Storage bucket named exactly `blog-images`. Ensure **public read** access policies are set up.
6.  **Database Tables:** The `blog_posts` and `waitlist` tables will be created automatically on the first admin login via `/api/login`. Ensure RLS is enabled and policies are correctly configured (public read for both, authenticated write for `blog_posts`, public insert for `waitlist`, admin full access for both).
7.  **Clone Repo:** Clone repo: git clone `https://github.com/Antibody/bloggr-node-js.git` then `cd bloggr`
8.  **Install & Run:** `npm install` then `npm run dev`.
9.  **Initial Admin Setup:** Access `http://localhost:3000/login.html`, log in with your admin credentials, you will then be redirected to `/blog/admin`.
10. **Login to Admin:** Access `/blog/newsletter` either directly (after login with the admin credentials) or via an envelope icon in `/blog/admin`

## Features

### Public Blog View

*   **Blog Index (`/blog`):** Server-Side Rendered (SSR) paginated list of published blog posts (newest first) with titles, snippets, and publication dates.
*   **Individual Post View (`/blog/:slug`):** SSR individual blog post pages with full content and SEO metadata.
*   **SEO Friendly:** Path-based URLs (`/blog/your-post-slug`) and SEO meta tags (title, description, keywords) for individual posts.
*   **"Read More/Read Less" Functionality:** Client-side JavaScript for "Read More/Read Less".

## Newsletter Features

This application includes a separate system for managing a newsletter and sending email reminders. The **signup form** is on the frontpage of the app (NOT of the blog) but can be moved anywhere (with minor modifications in `main.js`)

### User Features

*   **Newsletter Signup:** Users can submit their email address via a simple form on the main page (`/`) to join the newsletter.
*   **Duplicate Email Handling:** Prevents users from signing up with the same email multiple times and informs them of their existing rank.
*   **View Rank:** Users can see how many users are reading newsletter after they themselves signed up.
*   **Theme Switching:** Light/Dark mode toggle available on the frontpage (signup page).

### Admin Features

*   **Secure Login:** Admin access is protected by a session-based login (requires a specific admin email configured in environment variables).
*   **Initial Setup:** On the very first admin login the initial database table and bucket are created (with enabled RLS and policies) if the system hasn't been initialized.
*   **Launch Date Management:** Admins can view and set the official launch date and time using an intuitive date/time picker interface.
*   **Newsletter Management:**
    *   **View Waitlist:** Admins can download the entire newsletter as a CSV file.
    *   **Clear Waitlist:** Admins can clear all entries from the newsletter (preserving the admin's own record).
*   **Email Reminders:**
    *   **Manual Sending:** Admins can manually compose and send emails to everyone on the newsletter at any time.
    *   **Toggle Reminders Sent Flag:** Admins can manually toggle the `reminder_sent` flag in the database (this current does not have any useful functionality).
*   **Theme Switching:** Light/Dark mode toggle available on the admin pages.
*   **Logout:** Securely logs the admin out.

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
*   **Node.js with Express (`server.mjs`):** Handles server-side logic, routing, serves static files, and performs server-side rendering using EJS. Includes middleware for admin authentication and initial setup checks.
*   **API Routes (`routes/api.js`):** Defines REST API endpoints for:
    1.  **Blog Post Management:** Fetching blog posts (`/api/posts`, `/api/admin/posts`, `/api/posts/:slug`, `/api/post-content/:slug`), admin post management (`/api/create-post`, `/api/posts/:slug` (PUT, DELETE)), and image uploads (`/api/upload-image`).
    2.  **User Authentication:** Admin login (`/api/login`) and logout (`/api/logout`).
    3.  **Newsletter:** User signup (`/api/waitlist`), view rank (`/api/rank`), admin setup validation (`/api/admin/validate`), newsletter data retrieval (`/api/admin/get-all-waitlist`), newsletter clearing (`/api/admin/clear-waitlist`), manual reminder sending (`POST /api/admin/waitlist-reminders`), and toggling the reminder sent flag (`POST /toggle-reminders`).
*   **EJS Templates (`views/*.ejs`):** Used for Server-Side Rendering of the blog index and individual post pages, dynamically injecting blog post data into HTML templates.
*   **Frontend Static Files (`public/`):** Contains static HTML pages (`index.html`, `login.html`, `admin.html`, `date-time-setter.html`), CSS (`public/css/`), and client-side JavaScript (`public/js/`) for interactivity, form handling, API calls, and theme toggling.
*   **Supabase Integration (`lib/*.js`):**
    *   `lib/supabaseClient.js`: Initializes and exports Supabase client instances for both browser-side (anonymous key) and server-side (service role key) operations.
*   **Configuration (`.env`, `package.json`, `postcss.config.mjs`):**
    *   `.env`: Stores environment variables (Supabase keys, Resend key, JWT secret, etc.) for local development.
    *   `package.json`: Defines project dependencies and scripts (run commands).
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

### Data Flow - Newsletter

1.  **User Signup (`/`):**
    *   User visits the main page (`index.html`).
    *   Enters email in the form.
    *   Frontend (`public/js/main.js`) sends POST request to `/api/waitlist`.
    *   Backend (`routes/api.js`) validates email, retrieves `launch_date` from the admin record in the `waitlist` table, inserts the new email with the `launch_date`.
    *   If email exists, returns existing rank. If successful, calculates and returns the new user's rank based on `created_at`.
2.  **Admin Login (`/login.html`):**
    *   Admin navigates to `/login.html`.
    *   Enters `ADMIN_ALLOWED_EMAIL` and Supabase Auth password.
    *   Frontend (`public/js/login.js`) sends POST request to `/api/login`.
    *   Backend (`routes/api.js`) verifies email against `ADMIN_ALLOWED_EMAIL` and authenticates with Supabase Auth.
    *   If successful, creates a server-side session and sets a cookie.
3.  **Admin Dashboard Access (`/blog/admin`, `/blog/newsletter`, etc.):**
    *   Requests to protected admin routes are intercepted by `requireAdminAuth` middleware (`server.mjs`).
    *   Middleware checks for a valid session and verifies the email matches `ADMIN_ALLOWED_EMAIL`.
    *   If the `waitlist` table doesn't exist it creates it together with a bucket `blog-images`.

4.  **Manual Email Reminders (via Admin UI):**
    *   Admin triggers sending from the dashboard (`/blog/newsletter`).
    *   Frontend sends `POST /api/admin/waitlist-reminders` with custom content.
    *   Backend handler (`routes/api.js`) ignores `launch_date` and `reminder_sent` flag, fetches emails, and sends reminders via Resend using the provided custom content. Does NOT update the `reminder_sent` flag.

## Getting Started: Setting Up Your Application (Blog & Newsletter)

Follow these steps to get the application running on your own computer or deploy it online.

### Prerequisites

1.  **Node.js:** You need Node.js installed on your computer. You can download it from [nodejs.org](https://nodejs.org/). The `npm` (Node Package Manager) is included with Node.js.
2.  **Code:** You need the codebase for this project. If you haven't already, clone or download it.
3.  **Terminal/Command Prompt:** You'll need to run commands in a terminal window.
4.  **Supabase Account:** You need a Supabase account and project ([supabase.com](https://supabase.com/)).
5.  **Resend Account:** You need a Resend account and API key ([resend.com](https://resend.com/)).

### Step 1: Install Dependencies

Navigate to the main project directory (the one containing `package.json`) in your terminal and run:

```bash
npm install
```

This command downloads and installs all the necessary software packages the project relies on.

### Step 2: Set Up Supabase

Supabase provides the backend database, file storage, and authentication.

1.  **Create a Supabase Project:** Go to [supabase.com](https://supabase.com/) and sign up for a free account or log in. Create a new project if you don't have one. Choose a strong database password and save it securely.
2.  **Get API Credentials:**
    *   Go to your Supabase Project Settings -> API.
    *   Find `Project URL` and copy it.
    *   Find `Project API keys` -> `anon` `public`. Copy this key.
    *   Find `Project API keys` -> `service_role` `secret`. Copy this key. **Treat this key like a password - do not share it publicly.**
3.  **Get Database Connection String:**
    *   Go to your Supabase Project Settings -> Database -> Connection string -> URI.
    *   **For Local Development or for Persistent Servers:** You can use the "Direct connection" URI string (typically on port `5432`).
    *   **For Serverless Deployments (Vercel, Netlify, Cloud Run, AWS Lambda, etc.):** It is **highly recommended** to use the **Transaction** mode connection string which uses the Supabase connection pooler (PgBouncer, typically on port `6543`). This prevents exhausting database connections in serverless environments. Copy the "URI" string listed under **Transaction** mode. It will look something like: `postgresql://postgres.[project_ref]:[YOUR-PASSWORD]@[cloud]-[region].pooler.supabase.com:6543/postgres`.
4.  **Configure Authentication:**
    *   Go to **Authentication** (the user icon) in the left sidebar.
    *   Under **Providers**, ensure **Email** is enabled. You might want to disable "Confirm email" for easier local setup, but enable it for production deployment.
    *   Go to **Users** and click **Add user**. Create a user account for yourself (the administrator). Use a valid email address and a strong password. This email address **must** match the one you will set for `ADMIN_ALLOWED_EMAIL` in your environment variables.
5.  **Set Up Storage for Images (for Blog):**
    *   Go to **Storage** (the folder icon) in the left sidebar.
    *   Click **Create a new bucket**. Name the bucket exactly `blog-images`. Make the bucket **Public**.
    *   Ensure policies allow public read (`SELECT`) and authenticated write (`INSERT`, `UPDATE`, `DELETE`) for this bucket. The `/api/login` endpoint attempts to create these policies automatically.

6.  **Database Tables (`blog_posts`, `waitlist`):**
    *   These tables are **automatically created** the first time a logged-in admin visits the `/date-time-setter.html` page (via the `/api/admin/validate` endpoint).
    *   Ensure Row Level Security (RLS) is enabled for both tables. The `/api/login` and `/api/admin/validate` endpoints attempt to set up the necessary RLS policies (public read for both, public insert for `waitlist`, admin full access for both). Manual verification in the Supabase dashboard (Authentication -> Policies) is recommended.
7.  **Storage Bucket (`blog-images`):** Created also automatically and RLS is enabled for the bucket

### Step 3: Configure Environment Variables

This application relies heavily on environment variables for configuration. You **MUST** provide these values.

1.  **Create `.env` file (Local Development Only):** In the main project root directory (the same level as `package.json`), create a file named `.env`. **DO NOT commit this file to PUBLIC version control.**
2.  **Add Required Variables:** Add the following variables to your `.env` file (for local development) or configure them directly on your hosting platform (for production):

    ```dotenv
    # --- Supabase ---
    SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
    SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY # Required for server-side admin actions and setup
    DATABASE_URL=YOUR_DATABASE_CONNECTION_STRING # Use Transaction mode for serverless deployments

    # --- Resend ---
    RESEND_API_KEY=YOUR_RESEND_API_KEY
    RESEND_SENDER_EMAIL=your-verified-sender@example.com # Must be a verified email in Resend

    # --- Admin  ---
    ADMIN_ALLOWED_EMAIL=your-chosen-admin@example.com # MUST be the same as your supabase email with a corresponding password in Supabase Auth
       

    # --- Server and Telemetry ---
    PORT=3000 # Optional: Default is 3000
    NODE_ENV=development # Set to 'production' for deployment
    TELEMETRY_SERVER_URL=https://telemetry-vercel.vercel.app/api/telemetry # URL for the telemetry server
    ALLOW_TELEMETRY=TRUE # Set to FALSE to opt out of sending telemetry data
    ```
    Replace the placeholder values (`YOUR_...`) with your actual credentials and settings.

**Important Security Notes:**
*   Keep your `.env` file secure and **do not** commit it to PUBLIC repos in version control. For production, configure variables directly on your hosting platform.
*   Ensure the `ADMIN_ALLOWED_EMAIL` in your environment variables matches the email of the user you created in Supabase Auth, and that you know the password for that user.

### Step 4: Run the Application Locally

1.  Open your terminal in the project root directory.
2.  Run the command:
    ```bash
    npm run dev
    ```
3.  Open your web browser and go to `http://localhost:3000`.
4.  **Initial Admin Setup:** Navigate to `/login.html`. Log in using the email specified in `ADMIN_ALLOWED_EMAIL` and the password you set in Supabase Auth.
    *   If the `waitlist` or `blog_posts` tables do not exist, they will be created automatically along with a bucket `blog-images`.         
    *   After successful setup, you will be redirected to the main admin dashboard (`/blog/admin`).
5.  **Access Admin Areas:** You can now navigate to `/blog/admin` to manage blog posts or go `/blog/newsletter` to manage the waitlist and send reminders.
6.  **View Public Site:** Navigate to `/` to see the newsletter signup page or `/blog` to see the public blog index.

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

## Using the Newsletter Admin Area (`/blog/newsletter`)

Once logged in as an admin, navigate to `/blog/newsletter` to access the newsletter management features.

*   **Set Launch Date & Time:** Use the date/time picker to set or update the official launch date. 
*   **View newsletter users:** Click the "Download Newsletter CSV" button to download a CSV file containing all current newsletter entries (email and signup timestamp).
*   **Clear Waitlist:** Click the "Clear Newsletter List" button to remove all entries from the newsletter, except for your own admin record. Use with caution!
*   **Manual Email Reminders:** Use the form to compose a custom email (Sender Name, Subject, Message Text) and click "Send Manual Reminders" to immediately send this email to everyone currently on the newsletter list. This action ignores the launch date and the `reminder_sent` flag.
*   **Toggle Automated Reminders:** Click the "Toggle Automated Reminders Sent Flag" button to switch the `reminder_sent` flag in the database between `TRUE` and `FALSE`. As of now this does not have a functionality.

## Database Schema

The application uses two main tables in your Supabase database: `blog_posts` (for blog content) and `waitlist` (for newsletter signups).

### `blog_posts` Table

```sql
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    published_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    keywords TEXT,
    content TEXT NOT NULL,
    created_at TIMESTamptz NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to update 'updated_at' on modification
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- Unique index for slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);

-- Row Level Security (RLS) Policies
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts FORCE ROW LEVEL SECURITY;

-- Policy: Allow public read access
CREATE POLICY "Allow public read access"
ON public.blog_posts
FOR SELECT
USING (true);

-- Policy: Allow admin full access (replace 'your-admin-email@example.com' with your actual admin email)
CREATE POLICY "Allow admin full access"
ON public.blog_posts
FOR ALL
USING (auth.email() = 'your-admin-email@example.com')
WITH CHECK (auth.email() = 'your-admin-email@example.com');
```
*(Note: The admin email in the policy above should match your `ADMIN_ALLOWED_EMAIL` environment variable. The `/api/login` endpoint attempts to create these policies automatically on first login.)*

### `waitlist` Table

```sql
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(), -- Primary Key
  email text NOT NULL,                         -- User's email address
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()), -- Signup timestamp
  launch_date timestamptz,                     -- The configured launch date (same for all users)
  reminder_sent boolean DEFAULT FALSE,         -- Flag indicating if the automated reminder email was sent by e.g. cron (possible feature for future)
  CONSTRAINT waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_email_key UNIQUE (email) -- Ensure email uniqueness
);

-- Row Level Security (RLS) Policies
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist FORCE ROW LEVEL SECURITY;

-- Policy: Allow public read access (e.g., for checking rank)
CREATE POLICY "Allow public read access"
ON public.waitlist
FOR SELECT
USING (true);

-- Policy: Allow public insert (for new signups)
CREATE POLICY "Allow public insert"
ON public.waitlist
FOR INSERT
WITH CHECK (true);

-- Policy: Allow admin full access (replace 'your-admin-email@example.com' with your actual admin email)
CREATE POLICY "Allow admin full access"
ON public.waitlist
FOR ALL
USING (auth.email() = 'your-admin-email@example.com')
WITH CHECK (auth.email() = 'your-admin-email@example.com');
```
*(Note: The admin email in the policy above should match your `ADMIN_ALLOWED_EMAIL` environment variable. The `/api/admin/validate` endpoint attempts to create these policies automatically on initial setup.)*



## Telemetry Overview

Our application implements lightweight telemetry to monitor key events and errors. This data helps me improve stability, monitor user engagement, and optimize performance.

### What Telemetry Sends:

*   **User Signup Events:** When a user signs up, telemetry captures:
    *   `eventType`: "userSignup"
    *   `timestamp`: When the event occurred.
    *   `domain`: The domain from which the signup occurred.
    *   `signupCount`: The user's signup rank.
    *   `signupLatency`: Latency of the signup process.
    *   `receivedAt`: When the telemetry server received the event.
*   **Error Events:** When errors occur (e.g., during signup or reminder sending), telemetry records:
    *   `eventType`: "error"
    *   `message`: Description of the error.
    *   `details`: Specific technical details (error name, message, stack trace).
    *   Contextual information like the domain, route, method, or recipient email (for email errors).

### How Telemetry Sends Data:

Telemetry data is sent via a POST request to the URL specified in the `TELEMETRY_SERVER_URL` environment variable.

### Disabling Telemetry:

You have full control over telemetry:

*   Set `ALLOW_TELEMETRY=FALSE` (case-insensitive) in your environment variables to completely disable sending telemetry events.
*   Telemetry events are automatically blocked if the `RESEND_SENDER_EMAIL` ends with `@resend.dev`.
*   Events originating from `localhost` or `127.0.0.1` are automatically blocked.

## Deployment

To make your application accessible to everyone online, you need to deploy it.

1.  **Choose a Host:** Select a hosting provider that supports Node.js applications (e.g., Vercel, Netlify, Heroku, AWS, Google Cloud Run, etc.).
2.  **Connect Repository:** Link your code repository (e.g., GitHub, GitLab) to your chosen hosting provider.
3.  **Configure Build Settings:** Ensure the build command is `npm install` followed by any necessary build steps if you add them later (currently just `npm start` is needed to run).
4.  **Configure Environment Variables:** **Crucially**, add **all** the required environment variables (listed in the "Environment Variables" section) directly into your hosting provider's environment variable settings. **Do NOT rely on a `.env` file in production.** Use the **production values** for your Supabase and Resend keys, admin email.
5.  **Set `NODE_ENV`:** Ensure `NODE_ENV` is set to `production` in the hosting environment.
6.  **Deploy:** Trigger the deployment process.
7.  **Initial Setup (Post-Deployment):** After deployment, access your deployed app's `/login.html` page, log in as admin to complete the initial setup. This will auromatically create the tables, and image bucket, enable RLS and set admin record.
8.  **Access:** Your application will be live at the URL provided by your host (or your custom domain).

## Key API Endpoints

These are the backend routes that the admin interface uses to interact with Supabase:

*   `/blog/api/validate`: Checks if the user is logged in as an admin and ensures the `blog_posts` table exists (creates it if not).
*   `/api/admin/posts`: Gets the list of all posts for the admin view.
*   `/api/admin/create-post`: Creates a new blog post.
*   `/api/admin/posts/[slug]`: Gets, updates (PUT), or deletes (DELETE) a specific post identified by its `slug`.
*   `POST /api/waitlist`: Adds an email to the newsletter (public).
*   `GET /api/rank`: Retrieves the rank for a given email (public).
*   `POST /api/login`: Authenticates the admin user and creates a session.
*   `POST /api/logout`: Destroys the admin session and logs the user out.
*   `GET /api/admin/check-setup-status`: Checks if the `waitlist` table exists (admin).
*   `POST /api/admin/validate`: Initializes the database table, a bucket, enables RLS, and writes admin- and public-related policies.
*   `GET /api/admin/get-all-waitlist`: Retrieves all newsletter entries (admin).
*   `POST /api/admin/clear-waitlist`: Deletes all newsletter entries except the admin's record (admin).
*   `POST /api/admin/waitlist-reminders`: Manually triggers sending reminder emails (admin).
*   `POST /api/toggle-reminders`: Manually toggle `reminder_sent` flag in the `waitlist` table (admin).
*   `/api/admin/posts`: Gets the list of all blog posts for the admin view.
*   `/api/admin/create-post`: Creates a new blog post.
*   `/api/admin/posts/[slug]`: Gets, updates (PUT), or deletes (DELETE) a specific blog post identified by its `slug`.
*   `/api/admin/upload-image`: Handles image uploads to Supabase Storage.


Enjoy blogging and let the audience be with you!
