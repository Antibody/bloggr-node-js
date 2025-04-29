import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import pkg from 'pg'; // Import default export from pg
const { Pool } = pkg; // Destructure Pool from the default export
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
import { getSupabaseServerClient } from '../lib/supabaseClient.js'; // Use the server client (service role) for fetching posts
import multer from 'multer'; // For handling file uploads
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames
import { marked } from 'marked'; // For converting Markdown to HTML
import { Resend } from 'resend';

const router = express.Router();

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const supabase = getSupabaseServerClient();
const resendApiKey = process.env.RESEND_API_KEY;
const resendSenderEmail = process.env.RESEND_SENDER_EMAIL;
const allowedAdminEmail = process.env.ADMIN_ALLOWED_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const POSTS_PER_PAGE = 10;

// Centralized telemetry function
async function sendTelemetryEvent(eventType, payload) {
  if (process.env.ALLOW_TELEMETRY && process.env.ALLOW_TELEMETRY.toUpperCase() === "FALSE") {
    return;
  }

  const TELEMETRY_SERVER_URL = process.env.TELEMETRY_SERVER_URL;

  if (TELEMETRY_SERVER_URL) {
    try {
      const response = await fetch(TELEMETRY_SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          timestamp: new Date().toISOString(),
          ...payload,
        }),
      });

      if (!response.ok) {
        console.error(`Telemetry server responded with status: ${response.status}`);
      }
    } catch (err) {
      console.error("Error sending telemetry event:", err);
    }
  } else {
    console.warn("Telemetry URL not configured, event not sent:", eventType, payload);
  }
}

// Helper function to generate a plain text snippet from HTML content
// (Adapted from original app/blog/page.tsx)
function generateSnippetFromHtml(html, maxLength = 250) {
  if (!html) return "";

  // Remove HTML tags using a simple regex; may require refinement for complex HTML.
  let text = html.replace(/<[^>]+>/g, " ");
  text = text.replace(/\\s+/g, " ").trim(); // Replace multiple spaces/newlines with single space

  if (text.length > maxLength) {
    const truncated = text.substring(0, maxLength);
    // Try to cut at the last space to avoid breaking words
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + "...";
  }
  // Return empty string if the text content is very short (e.g., just spaces or empty tags)
  return text.length > 10 ? text : "";
}


router.get('/posts', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const currentPage = Math.max(1, page);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE - 1;

  try {
    const supabase = getSupabaseServerClient();

    const { count, error: countError } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Supabase count error:', countError);
      throw new Error(`Failed to count posts: ${countError.message}`);
    }
    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);

    const { data: postsDataRaw, error: postsError } = await supabase
      .from('blog_posts')
      .select('slug, title, content, published_at')
      .order('published_at', { ascending: false })
      .range(startIndex, endIndex);

    if (postsError) {
      console.error('Supabase fetch error:', postsError);
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    const postsData = (postsDataRaw || []).map(post => ({
      slug: post.slug,
      title: post.title,
      snippet: generateSnippetFromHtml(post.content),
      date: post.published_at,
    }));

    res.json({ posts: postsData, totalPages, currentPage });
  } catch (error) {
    console.error('Error in /api/posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts', details: error.message });
  }
});

// GET /api/admin/posts – All posts for admin dashboard
router.get('/admin/posts', async (req, res) => {
  try {
    const supabase = getSupabaseServerClient();

    const { data: postsDataRaw, error: postsError } = await supabase
      .from('blog_posts')
      .select('slug, title, content, published_at')
      .order('published_at', { ascending: false });

    if (postsError) {
      console.error('Supabase fetch error (admin):', postsError);
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    const postsData = (postsDataRaw || []).map(post => ({
      slug: post.slug,
      title: post.title,
      snippet: generateSnippetFromHtml(post.content),
      date: post.published_at,
    }));

    res.json({ posts: postsData });
  } catch (error) {
    console.error('Error in /api/admin/posts:', error);
    res.status(500).json({ error: 'Failed to fetch admin posts', details: error.message });
  }
});

// GET /api/posts/:slug – Fetch a single blog post by slug (include SEO fields)
router.get('/posts/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!slug) return res.status(400).json({ error: 'Missing slug parameter' });

  try {
    const supabase = getSupabaseServerClient();

    //  columns 'keywords' and 'description'
    const { data: postData, error: postError } = await supabase
      .from('blog_posts')
      .select('slug, title, content, published_at, keywords, description')
      .eq('slug', slug)
      .single();

    if (postError) {
      if (postError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Post not found' });
      }
      console.error(`Supabase error fetching post "${slug}":`, postError);
      throw new Error(`Failed to fetch post: ${postError.message}`);
    }
    if (!postData) return res.status(404).json({ error: 'Post not found' });

    //  return SEO fields in response
    res.json({
      slug: postData.slug,
      title: postData.title,
      content: postData.content,
      date: postData.published_at,
      seoKeywords: postData.keywords,
      seoDescription: postData.description,
    });
  } catch (error) {
    console.error(`Error in /api/posts/${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch post', details: error.message });
  }
});


// GET /api/post-content/:slug – Fetch only full content for AJAX
router.get('/post-content/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!slug) return res.status(400).json({ error: 'Missing slug parameter' });

  try {
    const supabase = getSupabaseServerClient();
    const { data: postData, error: postError } = await supabase
      .from('blog_posts')
      .select('slug, title, content, published_at')
      .eq('slug', slug)
      .single();

    if (postError) {
      if (postError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Post not found' });
      }
      console.error(`Supabase error fetching post content "${slug}":`, postError);
      throw new Error(`Failed to fetch post content: ${postError.message}`);
    }
    if (!postData) return res.status(404).json({ error: 'Post not found' });

    res.json({
      slug: postData.slug,
      title: postData.title,
      content: postData.content,
      date: postData.published_at,
    });
  } catch (error) {
    console.error(`Error in /api/post-content/${req.params.slug}:`, error);
    res.status(500).json({ error: 'Failed to fetch post content', details: error.message });
  }
});


// POST /api/waitlist - Add email to the waitlist
router.post('/waitlist', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required and must be a string' });
  }

  try {
    const supabase = getSupabaseServerClient(); // Use service role for direct insert/check

    // Check if email already exists
    const { data: existing, error: checkError } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 result without error

    if (checkError) {
      console.error('Supabase check error:', checkError);
      throw new Error(`Failed to check waitlist: ${checkError.message}`);
    }

    if (existing) {
      //  On duplicate, fetch and return rank with friendly message
      const rankResult = await pool.query(
        `SELECT rank
           FROM (
             SELECT email, created_at,
                    RANK() OVER (ORDER BY created_at ASC) AS rank
             FROM public.waitlist
           ) tmp
          WHERE tmp.email = $1;`,
        [email]
      );
      const rank = rankResult.rows[0]?.rank || null;
      return res.status(200).json({
        duplicate: true,
        rank,
        message: `You already signed up! Your signup number is ${rank}.`
      });
    }

    // Insert new email
    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({ email });

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      if (insertError.code === '23505') { // Unique violation code
        // Concurrent insert duplicate handling
        const rankResult = await pool.query(
          `SELECT rank
             FROM (
               SELECT email, created_at,
                      RANK() OVER (ORDER BY created_at ASC) AS rank
               FROM public.waitlist
             ) tmp
            WHERE tmp.email = $1;`,
          [email]
        );
        const rank = rankResult.rows[0]?.rank || null;
        return res.status(200).json({
          duplicate: true,
          rank,
          message: `You already signed up! Your signup number is ${rank}.`
        });
      }
      throw new Error(`Failed to add to waitlist: ${insertError.message}`);
    }

    // Fetch rank after successful signup
    const rankResult = await pool.query(
      `SELECT rank
         FROM (
           SELECT email, created_at,
                  RANK() OVER (ORDER BY created_at ASC) AS rank
           FROM public.waitlist
         ) tmp
        WHERE tmp.email = $1;`,
      [email]
    );
    const rank = rankResult.rows[0]?.rank || null;

    // Successfully added
    return res.status(200).json({
      success: true,
      rank,
      message: `Successfully signed up! Your signup number is ${rank}.`
    });

  } catch (error) {
    console.error('Error in /api/waitlist:', error);
    return res.status(500).json({ error: 'Failed to sign up', details: error.message });
  }
});

// === GET /api/rank ===
router.get('/rank', async (req, res) => {
  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email query parameter is required' });
  }

  try {
    const result = await pool.query(
      `SELECT rank
         FROM (
           SELECT email, created_at,
                  RANK() OVER (ORDER BY created_at ASC) AS rank
           FROM public.waitlist
         ) tmp
       WHERE tmp.email = $1;`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Email not found in waitlist' });
    }

    const { rank } = result.rows[0];
    return res.json({ rank });

  } catch (error) {
    console.error('Error in /api/rank:', error);
    return res.status(500).json({ error: 'Failed to get rank', details: error.message });
  }
});


/**
 * Sends reminder emails to the waitlist, tracking individual failures.
 * @param {object} [customOptions={}] - Options to customize sending behavior.
 * @param {string} [customOptions.from] - Display name for the sender.
 * @param {string} [customOptions.subject] - Email subject.
 * @param {string} [customOptions.text] - Email body text.
 * @param {boolean} [customOptions.forceSend=false] - Ignore launch date and reminder_sent flag if true.
 * @param {boolean} [customOptions.updateReminderSent=false] - Update reminder_sent flag if true.
 * @param {string} [customOptions.domain='unknown'] - Domain for telemetry.
 * @returns {Promise<{ message?: string; error?: string; status: number; hadErrors?: boolean; successCount?: number; errorCount?: number; failedEmails?: {email: string, error: any}[] }>}
 */
async function sendWaitlistReminders(customOptions = {}) {
  const options = {
    forceSend: false,
    updateReminderSent: false,
    domain: 'unknown', // Default domain if not provided
    ...customOptions
  };
  const domain = options.domain; // Use the domain from options for telemetry

  if (!resend) {
    console.error("Resend is not configured. RESEND_API_KEY must be set.");
    // Send telemetry for configuration error
    sendTelemetryEvent("error", {
      domain,
      message: "Resend configuration error in sendWaitlistReminders",
      errorName: "ConfigurationError",
      errorMessage: "Resend API Key (RESEND_API_KEY) is not configured.",
      severity: 'critical'
    });
    // Ensure return type matches Promise signature
    return { error: 'Email service (Resend API Key) is not configured on the server.', status: 501, hadErrors: true, failedEmails: [] };
  }
  if (!resendSenderEmail) {
    console.error("Resend sender email (RESEND_SENDER_EMAIL) is not configured or is empty in .env file.");
    // Send telemetry for configuration error
    sendTelemetryEvent("error", {
      domain,
      message: "Resend configuration error in sendWaitlistReminders",
      errorName: "ConfigurationError",
      errorMessage: "Resend Sender Email (RESEND_SENDER_EMAIL) is not configured.",
      severity: 'critical'
    });
     // Ensure return type matches Promise signature
    return { error: 'Resend sender email address is not configured or is empty on the server.', status: 501, hadErrors: true, failedEmails: [] };
  }


  let launchDateISO;
  let reminderSent = false;

  try {
    // const domain = 'server-internal-reminders'; // Domain is now passed in options
 
     const { data: settingsData, error: settingsError } = await supabase
      .from('waitlist')
      .select('launch_date, reminder_sent')
      .limit(1)
      .maybeSingle();
 
     if (settingsError) {
       console.error('Supabase error fetching settings (launch_date, reminder_sent):', settingsError);
       // Send telemetry for this specific error
       sendTelemetryEvent("error", {
         domain,
         message: "Supabase error fetching settings in sendWaitlistReminders",
         errorName: settingsError.name,
         errorMessage: settingsError.message,
         stackTrace: settingsError.stack, // Supabase errors might have stack
       });
       // Return structure includes error details
       return { error: 'Failed to fetch waitlist settings from database', status: 500, hadErrors: true, failedEmails: [] };
    }

    if (!settingsData || !settingsData.launch_date) {
      console.log('No launch_date found in the waitlist table.');
      // Send telemetry for missing launch date
      sendTelemetryEvent("error", {
        domain,
        message: "Missing launch date in sendWaitlistReminders",
        errorName: "ConfigurationError",
        errorMessage: "Launch date is not set in the database.",
      });
      return { error: 'Launch date is not set. Cannot send reminders.', status: 400, hadErrors: true, failedEmails: [] };
    }

    launchDateISO = settingsData.launch_date;
    reminderSent = !!settingsData.reminder_sent;

    const launchDate = new Date(launchDateISO);
    const now = new Date();

    console.log("Launch Date from DB:", launchDate.toISOString());
    console.log("Reminder Sent Flag from DB:", reminderSent);
    console.log("Now:", now.toISOString());
    console.log("Options:", options);

    // For GET (cron) calls: if not forcing send, then enforce that now >= launch_date
    if (!options.forceSend) {
      if (now.getTime() < launchDate.getTime()) {
        console.log("Current time is before launch date. Skipping reminders.");
        return {
          message: `Reminders not sent yet (launch date is in the future: ${launchDateISO})`,
          status: 200,
          hadErrors: false, successCount: 0, errorCount: 0, failedEmails: [] // Add missing fields
        };
      }
      if (reminderSent) {
        console.log("Reminder emails already marked as sent previously. Skipping.");
        return { message: "Reminder emails already marked as sent.", status: 200, hadErrors: false, successCount: 0, errorCount: 0, failedEmails: [] }; // Add missing fields
      }
    }

    console.log("Proceeding to send reminder emails...");

    const { data: waitlistEntries, error: fetchError } = await supabase
      .from('waitlist')
      .select('email')
      .neq('email', ''); // Select non-empty emails
 
     if (fetchError) {
       console.error('Supabase error fetching waitlist emails:', fetchError);
       // Send telemetry for this specific error
       sendTelemetryEvent("error", {
         domain,
         message: "Supabase error fetching waitlist emails in sendWaitlistReminders",
         errorName: fetchError.name,
         errorMessage: fetchError.message,
         stackTrace: fetchError.stack,
       });
       return { error: 'Failed to fetch waitlist emails from database', status: 500, hadErrors: true, failedEmails: [] };
    }

    const totalEmailsToAttempt = waitlistEntries?.length || 0;
    if (totalEmailsToAttempt === 0) {
      console.log('Waitlist is empty. No reminders to send.');
      return { message: 'Waitlist is empty. No reminders sent.', status: 200, hadErrors: false, successCount: 0, errorCount: 0, failedEmails: [] };
    }

    // Construct 'From' address using display name and sender email
    const defaultDisplayName = "Waitlist App";
    const displayName = options.from ? String(options.from).trim() : defaultDisplayName;
    const finalFrom = `"${displayName}" <${resendSenderEmail}>`; // Use environment variable for sender email

    const defaultSubject = "Reminder: Our Launch is Approaching!";
    const finalSubject = options.subject || defaultSubject;

// --- Refactored sendWaitlistReminders logic ---
    // NOTE: formatLaunchDateForDisplay is defined *before* this function
    /* const formattedLaunchDate = launchDateISO; */
   /*  const defaultText = `Hi there,\n\nJust a friendly reminder that our launch date is approaching!\n\nLaunch Date: ${launchDateISO}\n\nGet ready for our launch!`; */
    let finalText = options.text || defaultText;
    // Ensure launch date is included if custom text is provided but doesn't contain it
    /* if (options.text && !finalText.includes(launchDateISO)) {
      finalText += `\n\nLaunch Date: ${launchDateISO}`;
    } */
    const htmlContent = `<p>${finalText.replace(/\n/g, "<br>")}</p>`;

    console.log(`Attempting to send ${totalEmailsToAttempt} emails via Resend...`);

    let successCount = 0;
    const emailErrors = []; // Store failed emails and errors { email: string, error: any }

    for (const entry of waitlistEntries) {
      const toEmail = entry?.email;
      if (!toEmail) continue; // Skip if email is missing

      const emailPayload = {
        from: finalFrom,
        to: toEmail,
        subject: finalSubject,
        text: finalText,
        html: htmlContent,
      };

      try {
        // Use await with resend.emails.send
        const { data: sendData, error: sendError } = await resend.emails.send(emailPayload);

        if (sendError) {
          console.error(`❌ Resend error for email to ${toEmail}:`, sendError);
          // Store structured error, check for statusCode property
          const errorDetails = { name: sendError.name, message: sendError.message };
          if ('statusCode' in sendError) {
             errorDetails.statusCode = sendError.statusCode;
          }
          emailErrors.push({ email: toEmail, error: errorDetails });
          // Send telemetry for Resend error
          sendTelemetryEvent("error", {
            domain,
            message: "Resend API error during email sending",
            errorName: sendError.name,
            errorMessage: sendError.message,
            resendStatusCode: errorDetails.statusCode, // Include status code if available
            recipientEmail: toEmail,
            severity: 'warning'
          });
        } else {
          console.log(`✅ Email accepted by Resend for ${toEmail}:`, sendData?.id);
          successCount++;
        }
      } catch (networkError) {
        // Catch network/SDK errors during the fetch call within resend.emails.send
        console.error(`❌ Network/SDK Error sending email to ${toEmail}:`, networkError);
        emailErrors.push({ email: toEmail, error: { name: networkError.name, message: networkError.message } });
        sendTelemetryEvent("error", {
          domain,
          message: "Network/SDK error during email sending",
          errorName: networkError.name,
          errorMessage: networkError.message,
          stackTrace: networkError.stack,
          recipientEmail: toEmail,
          severity: 'warning'
        });
      }
    } // End of email sending loop

    const errorCount = emailErrors.length;
    const hadErrors = errorCount > 0;
    console.log(`Resend submission completed. Success: ${successCount}, Errors: ${errorCount}`);

    // Only update reminder_sent flag if this is a GET (cron) call AND there were successful sends.
    if (options.updateReminderSent && successCount > 0) {
      console.log("Updating reminder_sent flag in database...");
      const { error: updateError } = await supabase
        .from('waitlist')
        .update({ reminder_sent: true })
        // Ensure we only update rows matching the specific launch date we processed
        .eq('launch_date', launchDateISO); // Use the fetched launchDateISO

      if (updateError) {
         console.error("Supabase error updating reminder_sent flag:", updateError);
         // Send telemetry for this specific error
         sendTelemetryEvent("error", {
           domain,
           message: "Supabase error updating reminder_sent flag",
           errorName: updateError.name,
           errorMessage: updateError.message,
           stackTrace: updateError.stack,
         });
         console.warn("Warning: Failed to update reminder_sent flag after sending emails.");
         // Note: We don't return an error here, just log/telemetry it, as emails might have been sent.
      } else {
        console.log("Successfully updated reminder_sent flag.");
      }
    }

    // Construct final message
    let finalMessage = `Attempted to send ${totalEmailsToAttempt} emails. Successfully sent ${successCount} reminder emails.`;
    if (hadErrors) {
      finalMessage += ` ${errorCount} error(s) occurred.`;
      // Optionally list failed emails in the message if needed, though returning them in the object is better for programmatic use.
      // finalMessage += ` Failed emails: ${emailErrors.map(e => e.email).join(', ')}`;
    }

    return {
      message: finalMessage,
      status: 200, // Return 200 even if some emails failed, as the operation itself completed
      hadErrors: hadErrors,
      successCount: successCount,
      errorCount: errorCount,
      failedEmails: emailErrors // Return the list of failed emails and their errors
    };

   } catch (error) { // Catch unexpected errors in the main try block
     console.error("Unexpected error in sendWaitlistReminders:", error);
     // Send telemetry for unexpected errors in this function
     sendTelemetryEvent("error", {
       domain, // Use the domain from options
       message: "Unexpected error in sendWaitlistReminders",
       errorName: error.name,
       errorMessage: error.message,
       stackTrace: error.stack,
     });
     // Ensure the return structure matches the expected Promise type
     return {
       error: error.message || 'Internal server error while processing reminders.',
       status: 500,
       hadErrors: true, // Assume errors if we reach here
       successCount: 0,
       errorCount: 0, // Unknown specific errors, but indicate failure
       failedEmails: []
      };
  }
}
// --- End of  sendWaitlistReminders ---


// Send Reminders endpoints

// --- Reminders Endpoints ---
// POST: For web interface – always send reminders regardless of launch_date,
// and do not update the reminder_sent flag.
router.post('/waitlist-reminders', async (req, res) => {
  const { from, subject, text } = req.body; // 'from' is the display name
  if (!from || !subject || !text) {
    return res.status(400).json({ error: 'Sender name, subject, and message text are required.' });
  }
  // For POST, force sending and do not update reminder_sent.
  const domain = req.headers.host || 'unknown'; // Get domain from request
  const result = await sendWaitlistReminders({
    from,
    subject,
    text,
    forceSend: true,
    updateReminderSent: false,
    domain // Pass domain
  });
  // Return the detailed result object, status is always 200 if function completes
  // The 'hadErrors' field indicates partial failure.
  res.status(result.status).json(result);
});

router.get('/get-launch-date', async (req, res) => {
  const tableExists = await checkWaitlistTableExists();
  if (!tableExists) {
      console.warn("/get-launch-date called but table doesn't exist (should have been caught by requireAuth).");
      return res.status(200).json({ launchDate: null });
  }
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select('launch_date')
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('Supabase error fetching launch date:', error);
      throw new Error('Failed to fetch launch date from database');
    }
     res.status(200).json({ launchDate: data?.launch_date || null });
   } catch (error) {
     console.error('Error in /get-launch-date:', error);
     // Send telemetry for this specific error
     sendTelemetryEvent("error", {
       domain: req.headers.host || 'unknown',
       message: "Error in /get-launch-date",
       errorName: error.name,
       errorMessage: error.message,
       stackTrace: error.stack,
       route: req.originalUrl,
       method: req.method,
     });
     res.status(500).json({ error: error.message || 'Internal server error' });
  }
});


let isWaitlistTableChecked = false;
let waitlistTableExists = false;

async function checkWaitlistTableExists() {
  if (isWaitlistTableChecked) {
    return waitlistTableExists;
  }
  try {
    const result = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waitlist');"
    );
    waitlistTableExists = result.rows[0].exists;
    isWaitlistTableChecked = true;
    console.log(`Waitlist table exists check: ${waitlistTableExists}`);
     return waitlistTableExists;
   } catch (error) {
     console.error('🔴 Error checking if waitlist table exists:', error);
     // Send telemetry for this specific error
     sendTelemetryEvent("error", {
       domain: 'server-internal', // Or derive domain if possible/relevant
       message: "Error checking if waitlist table exists",
       errorName: error.name,
       errorMessage: error.message,
       stackTrace: error.stack,
     });
     waitlistTableExists = false;
     isWaitlistTableChecked = true;
     return false;
  }
}



// Download waitlist CSV
router.get('/get-all-waitlist', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Supabase error fetching all waitlist entries:', error);
      throw new Error('Failed to fetch waitlist data');
    }
     res.status(200).json(data || []);
   } catch (error) {
     console.error('Error in /get-all-waitlist:', error);
     // Send telemetry for this specific error
     sendTelemetryEvent("error", {
       domain: req.headers.host || 'unknown',
       message: "Error in /get-all-waitlist",
       errorName: error.name,
       errorMessage: error.message,
       stackTrace: error.stack,
       route: req.originalUrl,
       method: req.method,
     });
     res.status(500).json({ error: error.message || 'Internal server error' });
  }
});


// ── clear-waitlist endpoint ──
// Clears all records except the admin record (the first record with ADMIN_ALLOWED_EMAIL)
router.post('/clear-waitlist', async (req, res) => {
  try {
    // First, fetch the admin record (the first row with allowedAdminEmail)
    const { data: adminRecord, error: adminError } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', allowedAdminEmail)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
      
    if (adminError || !adminRecord) {
      console.error('Error fetching admin record:', adminError || 'Admin record not found');
      return res.status(500).json({ error: 'Failed to fetch admin record for clearing waitlist' });
    }
    
    // Delete all records except the admin record
    const { error } = await supabase
      .from('waitlist')
      .delete()
      .neq('id', adminRecord.id);
      
    if (error) {
      console.error('Supabase error clearing waitlist:', error);
      if (error.message.includes('permission denied')) {
         return res.status(403).json({ error: 'Permission denied. Server might need elevated privileges (Service Role Key) to clear the waitlist.' });
      }
      throw new Error('Failed to clear waitlist data');
    }
    const adminEmail = process.env.ADMIN_ALLOWED_EMAIL;
    console.log('Waitlist cleared successfully by admin:', adminEmail);
    res.status(200).json({ message: 'Waitlist cleared successfully, admin record preserved' });
     
   } catch (error) {
     console.error('Error in /clear-waitlist:', error);
     // Send telemetry for this specific error
     sendTelemetryEvent("error", {
       domain: req.headers.host || 'unknown',
       message: "Error in /clear-waitlist",
       errorName: error.name,
       errorMessage: error.message,
       stackTrace: error.stack,
       route: req.originalUrl,
       method: req.method,
       adminEmail: adminEmail, // Include relevant context
     });
     res.status(500).json({ error: error.message || 'Internal server error' });
  }
});


// ### toggle-reminders endpoint
router.post('/toggle-reminders', async (req, res) => {
  // Authenticate admin via JWT stored in cookies
  const token = req.cookies?.jwt;
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
  if (payload.email !== allowedAdminEmail) {
    return res.status(403).json({ error: "Not authorized" });
  }

  // Toggle reminder_sent flag in waitlist table
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    //  Fetch current reminder_sent flag for admin record
    const { rows } = await client.query(
      `SELECT reminder_sent 
         FROM public.waitlist 
        WHERE email = $1 
     ORDER BY created_at ASC 
        LIMIT 1;`,
      [allowedAdminEmail]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: "Admin record not found" });
    }

    const currentFlag = rows[0].reminder_sent;
    const newFlag = !currentFlag;

    //  Apply new flag to all records
    await client.query(
      `UPDATE public.waitlist 
          SET reminder_sent = $1 
        WHERE id <> '00000000-0000-0000-0000-000000000000';`,
      [newFlag]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      message: `Reminder flags toggled successfully. New value: ${newFlag}`
    });
  } catch (sqlError) {
    console.error("Error toggling reminders:", sqlError);
    await client.query('ROLLBACK');
    return res.status(500).json({
      error: `Failed to toggle reminder flags: ${sqlError instanceof Error ? sqlError.message : 'Unknown error'}`
    });
  } finally {
    client.release();
  }
});




// POST /api/login - Authenticate user, issue JWT, and setup blog_posts, storage bucket, and waitlist with RLS policies
router.post('/login', async (req, res) => {
  // Validate input
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Authenticate via Supabase
    const supabase = getSupabaseServerClient(); // service-role client
    const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (supabaseError) {
      console.error('Supabase sign-in error:', supabaseError);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!data?.session) {
      console.error('Supabase sign-in error: No session returned');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    const jwtPayload = {
      userId: data.user.id,
      email: data.user.email,
    };
    const token = jwt.sign(jwtPayload, jwtSecret, { expiresIn: '1h' });

    // --- Database, Storage & Waitlist Setup ---
    let dbSetupSuccess = false;
    let dbSetupMessage = 'Database setup skipped or already complete.';
    let storageSetupSuccess = false;
    let storageSetupMessage = 'Storage setup skipped or already complete.';
    let waitlistSetupSuccess = false; // New variable for waitlist setup status
    let waitlistSetupMessage = 'Waitlist setup skipped or already complete.'; // New message for waitlist

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adminEmail = process.env.ADMIN_ALLOWED_EMAIL; // Admin email for RLS policies and admin signup
    if (!adminEmail) {
      console.warn('ADMIN_ALLOWED_EMAIL not set: Admin policies and signup will not be created');
    }

    try {
      // Ensure uuid-ossp extension
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      console.log('uuid-ossp extension ensured.');

      // Ensure pgcrypto extension for gen_random_uuid()
      await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
      console.log('pgcrypto extension ensured.');

      // Ensure update_updated_at_column function
      await pool.query(`
        CREATE OR REPLACE FUNCTION public.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('update_updated_at_column function ensured.');

      // Ensure blog_posts table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.blog_posts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title TEXT NOT NULL,
            slug TEXT UNIQUE,
            published_at TIMESTAMPTZ NOT NULL,
            description TEXT,
            keywords TEXT,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      console.log('blog_posts table ensured.');

      // Ensure trigger for blog_posts.updated_at
      const triggerExistsResult = await pool.query(`
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_blog_posts_updated_at';
      `);
      if (triggerExistsResult.rowCount === 0) {
        await pool.query('DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;');
        await pool.query(`
          CREATE TRIGGER update_blog_posts_updated_at
          BEFORE UPDATE ON public.blog_posts
          FOR EACH ROW
          EXECUTE PROCEDURE public.update_updated_at_column();
        `);
        console.log('update_blog_posts_updated_at trigger created.');
      } else {
        console.log('update_blog_posts_updated_at trigger already exists.');
      }

      // Ensure unique index on blog_posts.slug
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);');
      console.log('idx_blog_posts_slug index ensured.');

      // Enable RLS & policies for blog_posts
      await pool.query('ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;');
      await pool.query('ALTER TABLE public.blog_posts FORCE ROW LEVEL SECURITY;');
      await pool.query('DROP POLICY IF EXISTS "Allow public read access" ON public.blog_posts;');
      await pool.query(`
        CREATE POLICY "Allow public read access"
        ON public.blog_posts
        FOR SELECT
        USING (true);
      `);
      console.log('Public read policy ensured for blog_posts table.');
      if (adminEmail) {
        await pool.query('DROP POLICY IF EXISTS "Allow admin full access" ON public.blog_posts;');
        await pool.query(`
          CREATE POLICY "Allow admin full access"
          ON public.blog_posts
          FOR ALL
          USING (auth.email() = '${adminEmail}')
          WITH CHECK (auth.email() = '${adminEmail}');
        `);
        console.log('Admin full access policy ensured for blog_posts table.');
      }
      dbSetupSuccess = true;
      dbSetupMessage = 'Blog database setup and policies applied successfully.';

      // Storage bucket creation & RLS policies
      await pool.query(`
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('blog-images', 'blog-images', true)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log("Storage bucket 'blog-images' ensured.");

      await pool.query('DROP POLICY IF EXISTS "Public Read Access for blog-images" ON storage.objects;');
      await pool.query(`
        CREATE POLICY "Public Read Access for blog-images"
        ON storage.objects
        FOR SELECT
        USING (bucket_id = 'blog-images');
      `);
      console.log("Public read policy for 'blog-images' bucket ensured.");

      await pool.query('DROP POLICY IF EXISTS "Admin Write Access for blog-images" ON storage.objects;');
      if (adminEmail) {
        await pool.query(`
          CREATE POLICY "Admin Write Access for blog-images"
          ON storage.objects
          FOR ALL
          USING (bucket_id = 'blog-images' AND auth.email() = '${adminEmail}')
          WITH CHECK (bucket_id = 'blog-images' AND auth.email() = '${adminEmail}');
        `);
        console.log("Admin write policy for 'blog-images' bucket ensured.");
      }
      storageSetupSuccess = true;
      storageSetupMessage = "Storage bucket setup and policies applied successfully.";

      // --- "waitlist" table creation & RLS policies ---
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.waitlist (
          id UUID NOT NULL DEFAULT gen_random_uuid(),
          email TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          launch_date TIMESTAMPTZ,
          reminder_sent BOOLEAN DEFAULT FALSE,
          CONSTRAINT waitlist_pkey PRIMARY KEY (id),
          CONSTRAINT waitlist_email_key UNIQUE (email)
        );
      `);
      console.log('waitlist table ensured.');

      await pool.query('ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;');
      console.log('RLS enabled for waitlist table.');
      await pool.query('ALTER TABLE public.waitlist FORCE ROW LEVEL SECURITY;');
      console.log('RLS forced for waitlist table.');

      await pool.query('DROP POLICY IF EXISTS "Allow public read access" ON public.waitlist;');
      await pool.query(`
        CREATE POLICY "Allow public read access"
        ON public.waitlist
        FOR SELECT
        USING (true);
      `);
      console.log('Public read policy ensured for waitlist table.');

      await pool.query('DROP POLICY IF EXISTS "Allow public insert" ON public.waitlist;');
      await pool.query(`
        CREATE POLICY "Allow public insert"
        ON public.waitlist
        FOR INSERT
        WITH CHECK (true);
      `);
      console.log('Public insert policy ensured for waitlist table.');

      if (adminEmail) {
        await pool.query('DROP POLICY IF EXISTS "Allow admin full access" ON public.waitlist;');
        await pool.query(`
          CREATE POLICY "Allow admin full access"
          ON public.waitlist
          FOR ALL
          USING (auth.email() = '${adminEmail}')
          WITH CHECK (auth.email() = '${adminEmail}');
        `);
        console.log('Admin full access policy ensured for waitlist table.');
      }

      // Insert ADMIN_ALLOWED_EMAIL as first waitlist signup with current timestamp
      if (adminEmail) {
        await pool.query(
          `
            INSERT INTO public.waitlist (email, launch_date)
            VALUES ($1, now())
            ON CONFLICT (email) DO NOTHING;
          `,
          [adminEmail]
        );
        console.log('Admin email inserted into waitlist with current timestamp.');
      }
      waitlistSetupSuccess = true;
      waitlistSetupMessage = 'Waitlist table, policies, and admin signup applied successfully.';

    } catch (setupError) {
      const errorMessage = setupError instanceof Error ? setupError.message : String(setupError);
      console.error('Error during setup:', errorMessage);
      dbSetupMessage = 'Error during database, storage, or waitlist setup.';
      storageSetupMessage = errorMessage;
      waitlistSetupMessage = errorMessage;
    } finally {
      try {
        await pool.end();
      } catch (poolCloseError) {
        console.error('Error closing database connection:', poolCloseError);
      }
    }

 


        // Set the JWT as a cookie (example using httpOnly cookie)
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/', // Specify the path for the cookie
        });

        // Return a success message, including DB setup status
        return res.status(200).json({
            success: true,
            message: `Login successful. ${dbSetupMessage}`,
            dbSetupSuccess: dbSetupSuccess // Indicate if DB setup ran without error
        });

    } catch (error) {
        // Log the error for server-side debugging, but do not expose details to the client
        console.error('Error in /api/login (outer catch):', error);
        // Always return a 401 for login failures, with a generic message
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

/**
 * POST /api/create-post - Create a new blog post
 * Expects: { title, htmlContent, date, seoKeywords, seoDescription }
 */
router.post('/create-post', async (req, res) => {
  // debug logging of incoming payload
  console.log('Received create-post body:', req.body);

  const { title, htmlContent, date, seoKeywords, seoDescription } = req.body;
  if (!title || !htmlContent || !date) {
    return res.status(400).json({ error: 'Title, content, and date are required.' });
  }

  try {
    const supabase = getSupabaseServerClient();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const htmlOutput = marked.parse(htmlContent);

    // insert post into Supabase
    const { error: insertError } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title,
        content: htmlOutput,
        published_at: date,
        keywords: seoKeywords || null,
        description: seoDescription || null
      });

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create post.', details: insertError.message });
    }

    // Determine the domain for telemetry
    const domain = req.headers.host || 'unknown';
    /* let telemetryDomain = domain; */
    const hostname = req.hostname;  
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      console.log(`Skipping telemetry for local host (${hostname})`);
    } else {
      const telemetryPayload = {
        eventType: 'blog_post_created',
        timestamp: new Date().toISOString(),
        domain: hostname,
        postTitle: title,
        postSlug: slug
      };
      try {
        await sendTelemetryEvent('blog_post_created', telemetryPayload);
        console.log('Telemetry sent successfully for blog_post_created:', telemetryPayload);
      } catch (telemetryError) {
        console.error('Failed to send telemetry for blog_post_created:', telemetryError);
      }
    }

    return res.status(201).json({ success: true, message: 'Post created successfully.' });
  } catch (err) {
    console.error('Error in /api/create-post:', err);
    return res.status(500).json({ error: 'Failed to create post.', details: err.message });
  }
});


// PUT /api/posts/:slug – Update existing blog post with SEO fields
router.put('/posts/:slug', async (req, res) => {
  const { slug } = req.params;
  const { title, htmlContent, date, seoKeywords, seoDescription } = req.body;
  if (!slug || !title || !htmlContent || !date) {
    return res.status(400).json({ error: 'Slug, title, content, and date are required.' });
  }

  try {
    const supabase = getSupabaseServerClient();
    const htmlOutput = marked.parse(htmlContent);

    // include 'keywords' and 'description' columns in update
    const { error } = await supabase
      .from('blog_posts')
      .update({
        title,
        content: htmlOutput,
        published_at: date,
        keywords: seoKeywords || null,
        description: seoDescription || null
      })
      .eq('slug', slug);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: 'Failed to update post.' });
    }

    res.json({ success: true, message: 'Post updated successfully.' });
  } catch (err) {
    console.error(`Error in PUT /api/posts/${slug}:`, err);
    res.status(500).json({ error: 'Failed to update post.', details: err.message });
  }
});

// DELETE endpoint i.e. delete a blog post
router.delete('/admin/posts/:slug', async (req, res) => {
  console.log('Received DELETE request for slug:', req.params.slug); // Log the slug received
  const { slug } = req.params;
  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  try {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('slug', slug);

    if (error) {
      console.error(`Supabase delete error for slug "${slug}":`, error);
      return res.status(500).json({ error: 'Failed to delete post.', details: error.message });
    }

    return res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    console.error(`Error in DELETE /api/admin/posts/${slug}:`, err);
    return res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// POST /api/upload-image – Upload an image to Supabase storage
router.post('/upload-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  const file = req.file;
  const bucketName = 'blog-images';
  const fileName = `${uuidv4()}-${file.originalname}`;

  try {
    const supabase = getSupabaseServerClient();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    if (!urlData || !urlData.publicUrl) {
      console.error('Supabase storage getPublicUrl error: No public URL returned for path:', fileName);
      throw new Error('Failed to get image URL after upload.');
    }

    res.status(200).json({ success: true, imageUrl: urlData.publicUrl });
  } catch (error) {
    console.error('Error in /api/upload-image:', error);
    res.status(500).json({ error: 'Failed to upload image.', details: error.message });
  }
});

router.post('/logout', (req, res) => {
  if (!req.session) {
      console.warn('logout: req.session is undefined; clearing cookie and returning success');
      res.clearCookie('waitlist-session');
      return res.status(200).json({ message: 'Logout successful' });
    }

  const userEmail = req.session?.user?.email;
   req.session.destroy((err) => {
     if (err) {
       console.error('Session destruction error:', err);
       // Send telemetry for session destroy error
       sendTelemetryEvent("error", {
         domain: req.headers.host || 'unknown',
         message: "Session destruction error during logout",
         errorName: err.name,
         errorMessage: err.message,
         stackTrace: err.stack,
         route: req.originalUrl,
         method: req.method,
         userEmail: userEmail || 'Unknown user', // Include relevant context
       });
       return res.status(500).json({ error: 'Could not log out, please try again' });
     }
     res.clearCookie('waitlist-session');
    console.log(`User logged out: ${userEmail || 'Unknown user'}`);
    res.status(200).json({ message: 'Logout successful' });
  });
});


export default router;
