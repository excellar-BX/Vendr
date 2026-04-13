import 'dotenv/config'
import { emailService } from '../src/lib/email'

async function sendTestEmail() {
  try {
    console.log('[Test] Sending test email to excellenceay49@gmail.com...')
    
    await emailService.sendEmail({
      to: 'excellenceay49@gmail.com',
      subject: 'Brevo SMTP Test - Vendr',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#E8521A;margin-bottom:8px;">Brevo SMTP Test</h2>
          <p style="color:#333;margin-bottom:24px;">This is a test email sent using Brevo SMTP via nodemailer.</p>
          <p style="color:#333;margin-bottom:24px;">If you received this email, the Brevo SMTP configuration is working correctly!</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">Sent from Vendr Backend</p>
        </div>
      `,
    })
    
    console.log('[Test] Test email sent successfully!')
  } catch (error) {
    console.error('[Test] Failed to send test email:', error)
    throw error
  }
}

sendTestEmail()
