import type { Env } from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

type EmailPayload = {
  tokenId: string;
  message: string;
  address: string;
  timestamp: number;
};

const formatAddress = (address: string) => {
  if (!address || address.length < 9) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
};

export async function handleEmailRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  let body: EmailPayload;
  try {
    body = (await request.json()) as EmailPayload;
  } catch (error) {
    console.error('Invalid JSON payload', { error });
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const { tokenId, message, address, timestamp } = body;
  if (!tokenId || !message || !address || typeof timestamp !== 'number') {
    console.error('Missing required email fields', body);
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const { BREVO_API_KEY, SENDER_EMAIL, RECEIVER_EMAIL } = env;
  if (!BREVO_API_KEY || !SENDER_EMAIL || !RECEIVER_EMAIL) {
    console.error('Brevo configuration incomplete');
    return new Response(JSON.stringify({ error: 'Email service misconfigured' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>New Token Gate Message</h2>
        <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
          <p><strong>Token ID:</strong> ${tokenId}</p>
          <p><strong>From Address:</strong> ${address}</p>
          <p><strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString()}</p>
          <hr style="border: 1px solid #ddd;">
          <p><strong>Message:</strong></p>
          <div style="white-space: pre-wrap; background-color: white; padding: 15px; border-radius: 3px;">
${message}
          </div>
        </div>
      </body>
    </html>
  `;

  const emailPayload = {
    sender: { name: 'RitoSwap Gate', email: SENDER_EMAIL },
    to: [{ email: RECEIVER_EMAIL, name: 'RitoSwap Admin' }],
    subject: `Gated Msg by ${formatAddress(address)}`,
    htmlContent,
    textContent: `Token ID: ${tokenId}\nFrom: ${address}\nTimestamp: ${new Date(timestamp).toLocaleString()}\n\nMessage:\n${message}`,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  const responseText = await response.text();
  let responseJson: unknown;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    console.error('Non-JSON response from Brevo:', responseText);
    return new Response(JSON.stringify({ error: 'Email provider returned invalid payload' }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }

  if (!response.ok) {
    console.error('Brevo error response', response.status, responseJson);
    return new Response(
      JSON.stringify({
        error: 'Failed to send email',
        details: responseJson,
      }),
      { status: 502, headers: JSON_HEADERS },
    );
  }

  const messageId =
    typeof responseJson === 'object' && responseJson && 'messageId' in responseJson
      ? (responseJson as Record<string, unknown>).messageId
      : undefined;

  console.log('Email sent successfully', { messageId });
  return new Response(JSON.stringify({ success: true, messageId }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}
