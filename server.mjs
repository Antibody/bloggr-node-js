import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env
import cookieParser from 'cookie-parser';
import ejs from 'ejs'; // Import EJS

// Import Supabase client setup
import { getSupabaseServerClient, supabaseBrowserCredentials } from './lib/supabaseClient.js';
import apiRoutes from './routes/api.js'; // Import the API router
import { marked } from 'marked'; // Import marked if needed for snippets (or use a simpler regex)

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Helper Function for Snippets (adapted from routes/api.js) ---
const POSTS_PER_PAGE = 10; // Define posts per page for pagination

function generateSnippetFromHtml(html, maxLength = 250) {
  if (!html) return "";
  // Simple regex to remove HTML tags
  let text = html.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim(); // Replace multiple spaces/newlines

  if (text.length > maxLength) {
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + "...";
  }
  // Return the text even if it's short, don't return empty string based on length
  return text;
}
// --- End Helper Function ---

const app = express();
const PORT = process.env.PORT || 3000;

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Specify the views directory

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Updated /blog route for SSR ---
app.get('/blog', async (req, res, next) => { // Added next for error handling
  const page = parseInt(req.query.page, 10) || 1;
  const currentPage = Math.max(1, page);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE - 1;

  try {
    const supabase = getSupabaseServerClient();

    // Get total count
    const { count, error: countError } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError; // Let error handler catch it

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);

    // Get posts for the current page
    const { data: postsDataRaw, error: postsError } = await supabase
      .from('blog_posts')
      .select('slug, title, content, published_at') // Fetch content for snippet generation
      .order('published_at', { ascending: false })
      .range(startIndex, endIndex);

    if (postsError) throw postsError; // Let error handler catch it

    // Process posts for the template
    const postsData = (postsDataRaw || []).map(post => ({
      slug: post.slug,
      title: post.title,
      snippet: generateSnippetFromHtml(post.content), // Generate snippet server-side
      date: post.published_at,
    }));

    // Render the EJS template
    res.render('blog', {
      posts: postsData,
      totalPages,
      currentPage
    });

  } catch (error) {
    console.error('Error fetching blog posts for SSR:', error);
    next(error); // Pass error to the error handling middleware
  }
});
// --- End Updated /blog route ---

// --- Specific /blog routes MUST come before /blog/:slug ---
app.get('/blog/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Middleware to protect /blog/admin
import jwt from 'jsonwebtoken';

function requireAdminAuth(req, res, next) {
    const token = req.cookies.jwt;
    if (!token) {
        return res.redirect('/blog/login');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (
            decoded &&
            decoded.email &&
            process.env.ADMIN_ALLOWED_EMAIL &&
            decoded.email === process.env.ADMIN_ALLOWED_EMAIL
        ) {
            // Authenticated and authorized
            return next();
        } else {
            return res.redirect('/blog/login');
        }
    } catch (err) {
        return res.redirect('/blog/login');
    }
}

app.get('/blog/admin', requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'app', 'blog', 'admin', 'admin.html'));
});

app.get('/blog/newsletter', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'blog', 'newsletter', 'newsletter-admin.html'));
});




// --- Updated /blog/:slug route for SSR ---
app.get('/blog/:slug', async (req, res, next) => { // Changed route to /blog/:slug
  const { slug } = req.params; // Get slug from route parameter

  if (!slug) {
    // This condition is less likely with path params, but good practice
    return res.status(400).send('Missing post slug');
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data: postData, error: postError } = await supabase
      .from('blog_posts')
      .select('slug, title, content, published_at, keywords, description') // Select all needed fields
      .eq('slug', slug)
      .single();

    if (postError && postError.code !== 'PGRST116') { // Throw if error is not 'not found'
        throw postError;
    }

    if (!postData) {
        // Render the post template with a 'not found' state or a dedicated 404 page
        return res.status(404).render('post', { post: null }); // Pass null post
    }

    // Render the EJS template with the fetched post data
    res.render('post', {
      post: {
        slug: postData.slug,
        title: postData.title,
        content: postData.content, // Pass full HTML content
        date: postData.published_at,
        seoKeywords: postData.keywords,
        seoDescription: postData.description,
      }
    });

  } catch (error) {
    console.error(`Error fetching post "${slug}" for SSR:`, error);
    next(error); // Pass error to the error handling middleware
  }
});
// --- End Updated /blog/:slug route ---


// Mount the API routes
app.use('/api', apiRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  // You can add the Supabase credentials here for frontend reference if needed,
  // but be careful not to expose the service role key.
  // console.log('Supabase Browser URL:', supabaseBrowserCredentials.url);
});

// Basic error handling (optional enhancement)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
