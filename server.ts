import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' })); // Need large limit for base64 PDF

  // API Routes
  app.post('/api/send-email', async (req, res) => {
    try {
      const { pdfBase64, clientEmail, clientName } = req.body;
      
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        throw new Error("Missing RESEND_API_KEY environment variable. Cannot send email.");
      }

      const resend = new Resend(resendApiKey);

      // Extract raw base64 data by removing any data URI prefix if present
      const base64Data = pdfBase64.includes('base64,') ? pdfBase64.split('base64,')[1] : pdfBase64;

      const buffer = Buffer.from(base64Data, 'base64');

      const response = await resend.emails.send({
        // Resend sandbox only allows sending from onboarding@resend.dev unless domain is verified
        from: 'Wayside Services <onboarding@resend.dev>',
        to: [clientEmail],
        subject: `Your Property Maintenance Report - Wayside Services`,
        html: `
          <div style="font-family: sans-serif; color: #1A3620;">
            <p>Dear ${clientName},</p>
            <p>Thank you for choosing Wayside Services for your preventative maintenance needs.</p>
            <p>Please find attached your monthly preventative maintenance inspection report.</p>
            <p>If you have any questions or require further service, please don't hesitate to reach out.</p>
            <br/>
            <p>Best regards,</p>
            <p><strong>The Wayside Services Team</strong></p>
          </div>
        `,
        attachments: [
          {
            filename: 'Wayside_Services_Inspection_Report.pdf',
            content: buffer,
          },
        ]
      });

      res.json({ success: true, response });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to send email' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
