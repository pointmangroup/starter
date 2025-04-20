import type { APIRoute } from 'astro';
import { z } from 'zod'; // Import Zod

// Minimal KV Namespace
interface KVNamespace {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

interface EnvBindings {
  ZEPTO_TOKEN?: string;
  RECIPIENT_EMAIL?: string;
  FORM_SUBMISSIONS?: KVNamespace;
  TURNSTILE_SECRET?: string;
}

interface ClassicContext {
  env?: EnvBindings;
}

interface PagesLocalsRuntime {
  runtime?: {
    env?: EnvBindings;
  };
}

interface PagesContext {
  locals?: PagesLocalsRuntime;
}

type ExtendedAPIRouteContext = APIRoute & ClassicContext & PagesContext;

// Define Zod schema for input validation
const ContactFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required.' }),
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required.' })
    .email({ message: 'Invalid email address.' }),
  phone: z.string().trim().optional(), // Keep optional fields as they are
  service: z.string().trim().optional(),
  message: z.string().trim().min(1, { message: 'Message is required.' }),
});

export const POST: APIRoute = async (context) => {
  try {
    const extendedCtx = context as unknown as ExtendedAPIRouteContext;

    const envFromClassic = extendedCtx.env ?? {};
    const envFromPages = extendedCtx.locals?.runtime?.env ?? {};

    const ZEPTO_TOKEN = envFromClassic.ZEPTO_TOKEN || envFromPages.ZEPTO_TOKEN;
    const RECIPIENT_EMAIL =
      envFromClassic.RECIPIENT_EMAIL || envFromPages.RECIPIENT_EMAIL;
    const FORM_SUBMISSIONS =
      envFromClassic.FORM_SUBMISSIONS || envFromPages.FORM_SUBMISSIONS;
    const TURNSTILE_SECRET =
      envFromClassic.TURNSTILE_SECRET ?? envFromPages.TURNSTILE_SECRET;

    const rawBody = await context.request.json();

    // Validate the request body using Zod
    const validationResult = ContactFormSchema.safeParse(rawBody);

    if (!validationResult.success) {
      console.error('Validation Errors:', validationResult.error.flatten());
      // Return 400 with specific validation errors
      return new Response(
        JSON.stringify({
          message: 'Validation failed.',
          errors: validationResult.error.flatten().fieldErrors, // Send field-specific errors
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use the validated data (type is inferred by Zod)
    const { name, email, phone, service, message } = validationResult.data;

    if (!ZEPTO_TOKEN || !RECIPIENT_EMAIL) {
      console.error('Missing ZEPTO_TOKEN or RECIPIENT_EMAIL in environment.');
      // Return 500 Internal Server Error for server config issues
      return new Response(
        JSON.stringify({
          message: 'Server configuration error. Please try again later.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received contact form submission:', {
      name,
      email,
      phone,
      service,
      message,
    });
    console.log('RECIPIENT_EMAIL:', RECIPIENT_EMAIL);

    // Validate Turnstile token
    const turnstileToken = rawBody?.['cf-turnstile-response'];

    if (!turnstileToken || !TURNSTILE_SECRET) {
      return new Response(
        JSON.stringify({ message: 'Missing Turnstile token or secret.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const verifyResp = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: TURNSTILE_SECRET,
          response: turnstileToken,
        }),
      }
    );
    const verifyData = await verifyResp.json();

    if (!verifyData?.success) {
      return new Response(
        JSON.stringify({ message: 'Invalid Turnstile token.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const domain = 'fonssprinklerrepair.com';
    const fromName = `Contact Form`;
    const fromAddress = `noreply@${domain}`;
    const subject = `Message from ${name}`;

    const htmlBody = `
      <h3>Contact Form Submission</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Service:</strong> ${service || 'N/A'}</p>
      <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
      <hr/>
      <p><small>This email was sent from the contact form on ${domain}.</small></p>
    `;

    const zeptoPayload = {
      from: { address: fromAddress, name: fromName },
      to: [{ email_address: { address: RECIPIENT_EMAIL } }],
      reply_to: {
        address: email,
        name: name,
      },
      subject: subject,
      htmlbody: htmlBody,
    };

    const zeptoResp = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${ZEPTO_TOKEN}`,
      },
      body: JSON.stringify(zeptoPayload),
    });

    const zeptoText = await zeptoResp.text();

    if (!zeptoResp.ok) {
      console.error('ZeptoMail send error:', zeptoResp.status, zeptoText);
      // Return 500 Internal Server Error for email sending failure
      return new Response(
        JSON.stringify({
          message: 'Failed to send email. Please try again later.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (FORM_SUBMISSIONS) {
      const timestamp = Date.now();
      const uniqueKey = `submission-${timestamp}`;
      const storedObject = {
        name,
        email,
        phone,
        service,
        message,
        timestamp: new Date(timestamp).toISOString(),
      };

      try {
        await FORM_SUBMISSIONS.put(uniqueKey, JSON.stringify(storedObject));
      } catch (kvErr) {
        console.error('KV storage error:', kvErr);
      }
    }

    // Return 200 OK on success
    return new Response(
      JSON.stringify({ message: 'Message sent successfully!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Handle unexpected errors
    if (error instanceof SyntaxError) {
      console.error('JSON Parsing Error:', error);
      return new Response(
        JSON.stringify({ message: 'Invalid request format.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.error('Form submission error:', error);
    // Return 500 Internal Server Error for unexpected errors
    return new Response(
      JSON.stringify({
        message: 'An unexpected server error occurred. Please try again later.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
