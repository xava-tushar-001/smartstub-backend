const frontendUrl = process.env.FRONTEND_URL

module.exports = {
  otp_email: (content) =>
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OTP Verification</title>
    <style type="text/css">
      @media only screen and (max-width: 600px) {
        .container {
          width: 100% !important;
        }
        .otp-box {
          padding: 12px 20px !important;
          font-size: 24px !important;
        }
      }
      a {
        color: #28a745;
        text-decoration: none;
      }
    </style>
  </head>
  <body
    style="margin:0; padding:0; background-color:#f5f7fa; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6;"
  >
    <!-- Preheader Text -->
    <div style="display: none; max-height: 0px; overflow: hidden;">
      Your verification code is {{OTP_CODE}}. This code expires in 10 minutes.
    </div>

    <!-- Main Email Container -->
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      bgcolor="#f5f7fa"
      style="padding: 40px 0;"
    >
      <tr>
        <td align="center">
          <!-- Brand Name (Text Only) -->
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width: 600px; margin-bottom: 20px;"
          >
            <tr>
              <td align="center" style="padding: 0 0 15px 0;">
                <h2 style="color: #28a745; margin: 0; font-weight: 600;">
                  YourBrand
                </h2>
              </td>
            </tr>
          </table>

          <!-- Content Container -->
          <table
            class="container"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            bgcolor="#ffffff"
            style="max-width: 600px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;"
          >
            <!-- Header -->
            <tr>
              <td
                style="background-color: #28a745; padding: 25px; text-align: center;"
              >
                <h1
                  style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 600; letter-spacing: 0.5px;"
                >
                  ${content.subject}
                </h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td
                style="padding: 40px 30px; color: #333333; font-size: 16px; line-height: 1.6; text-align: center;"
              >
                <p style="margin: 0 0 15px 0;">${content.hello},</p>
                <p style="margin: 0 0 25px 0;">${content.complete}</p>

                <!-- OTP Box -->
                <table
                  align="center"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="margin: 0 auto 30px auto;"
                >
                  <tr>
                    <td
                      class="otp-box"
                      style="background-color: #f8f9fa; padding: 18px 50px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #28a745; font-family: monospace; text-align: center; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);"
                    >
                      ${content.otp_code}
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 10px 0; font-weight: 500;">
                  This code will expire in
                  <strong style="color: #dc3545;">10 minutes</strong>.
                </p>
                <p style="margin: 0 0 25px 0; font-size: 14px; color: #6c757d;">
                  ${content.security}.
                </p>

                <!-- Call to Action -->
                <table
                  align="center"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="margin: 0 auto;"
                >
                  <tr>
                    <td style="border-radius: 6px;" bgcolor="#28a745">
                      <a
                        href="#"
                        target="_blank"
                        style="display: inline-block; padding: 12px 30px; color: #ffffff; font-weight: 500; text-decoration: none;"
                        >Verify Account</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #6c757d; border-top: 1px solid #e9ecef;"
              >
                <p style="margin: 0 0 10px 0;">
                  Need help?
                  <a
                    href="mailto:support@yourcompany.com"
                    style="color: #28a745;"
                    >Contact our support team</a
                  >
                </p>
                <p style="margin: 0 0 10px 0;">
                  © 2025 Your Company. All rights reserved.
                </p>
                <p style="margin: 0;">
                  <a href="#" style="color: #6c757d; margin: 0 5px;"
                    >Privacy Policy</a
                  >
                  |
                  <a href="#" style="color: #6c757d; margin: 0 5px;"
                    >Terms of Service</a
                  >
                </p>
              </td>
            </tr>
          </table>

          <!-- Secondary Footer -->
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width: 600px; margin-top: 20px;"
          >
            <tr>
              <td
                style="padding: 0; text-align: center; font-size: 12px; color: #adb5bd;"
              >
                <p style="margin: 0 0 5px 0;">
                  123 Business Ave, Suite 100, San Francisco, CA 94107
                </p>
                <p style="margin: 0;">
                  <a href="#" style="color: #adb5bd; margin: 0 5px;"
                    >Unsubscribe</a
                  >
                  |
                  <a href="#" style="color: #adb5bd; margin: 0 5px;"
                    >Preferences</a
                  >
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `,

  forgot_password_email: (content) =>
    `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0,0,0,0.05);
    }
    .button {
      display: inline-block;
      padding: 12px 20px;
      background-color: #007BFF;
      color: #ffffff;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 20px;
    }
    .footer {
      font-size: 12px;
      color: #999999;
      text-align: center;
      margin-top: 30px;
    }
  </style>
</head>
<body>

  <div class="email-container">
    <h2>Password Reset Request</h2>
    <p>Hi ${content.name},</p>
    <p>We received a request to reset your password. Click the button below to choose a new one:</p>

    <a href="${frontendUrl}/${content.link}" class="button">Reset Password</a>

    <p>If you did not request a password reset, please ignore this email. The link will expire in 1hr.</p>

    <p>Need help? Contact us at <a href="mailto:{{CompanySupportEmail}}">{{CompanySupportEmail}}</a>.</p>

    <div class="footer">
      &copy; 2025 CompanyName| <a href="CompanyWebsite">CompanyWebsite</a>
    </div>
  </div>

</body>
</html>

`


};
