const frontendUrl = process.env.FRONTEND_URL

module.exports = {
  otp_email: (content) =>
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${content.subject}</title>
    <style type="text/css">
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@600&display=swap');
      @media only screen and (max-width: 600px) {
        .container {
          width: 100% !important;
        }
        .otp-box {
          padding: 14px 24px !important;
          font-size: 22px !important;
          letter-spacing: 6px !important;
        }
      }
      a {
        color: #1648c0;
        text-decoration: none;
      }
    </style>
  </head>
  <body
    style="margin:0; padding:0; background-color:#f4f7ff; font-family: 'Outfit', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6;"
  >
    <!-- Preheader Text -->
    <div style="display: none; max-height: 0px; overflow: hidden;">
      Your verification code is ${content.otp_code}. This code expires in 10 minutes.
    </div>

    <!-- Main Email Container -->
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      bgcolor="#f4f7ff"
      style="padding: 40px 0;"
    >
      <tr>
        <td align="center">
          <!-- Brand Row -->
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width: 600px; margin-bottom: 20px;"
          >
            <tr>
              <td align="center" style="padding: 0 0 15px 0;">
                <img
                  src="${frontendUrl}/logo.webp"
                  alt="SmartStub"
                  height="36"
                  style="height: 36px; width: auto; vertical-align: middle; margin-right: 10px;"
                />
                <span
                  style="font-size: 20px; font-weight: 700; color: #07112b; vertical-align: middle;"
                  >SmartStub</span
                >
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
            style="max-width: 600px; border-radius: 16px; box-shadow: 0 4px 20px rgba(7,17,43,0.08); overflow: hidden;"
          >
            <!-- Header -->
            <tr>
              <td
                bgcolor="#07112b"
                style="background: linear-gradient(135deg, #07112b 0%, #0d2255 50%, #0b1e48 100%); padding: 28px; text-align: center;"
              >
                <h1
                  style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 0.3px;"
                >
                  ${content.subject}
                </h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td
                style="padding: 40px 30px; color: #334155; font-size: 16px; line-height: 1.6; text-align: center;"
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
                      style="background-color: #ebf1ff; padding: 18px 50px; border-radius: 12px; font-size: 28px; font-weight: 600; letter-spacing: 8px; color: #1648c0; font-family: 'JetBrains Mono', monospace; text-align: center;"
                    >
                      ${content.otp_code}
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 10px 0; font-weight: 500;">
                  This code will expire in
                  <strong style="color: #f04444;">10 minutes</strong>.
                </p>
                <p style="margin: 0; font-size: 14px; color: #5c6b82;">
                  ${content.security}.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="background-color: #f4f7ff; padding: 24px; text-align: center; font-size: 13px; color: #5c6b82; border-top: 1px solid #dde3ee;"
              >
                <p style="margin: 0 0 6px 0; font-weight: 600; color: #07112b;">
                  SmartStub
                </p>
                <p style="margin: 0;">
                  &copy; ${new Date().getFullYear()} SmartStub, Inc. Bank-level encryption &middot; your data is always private and secure.
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
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password</title>
    <style type="text/css">
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
      @media only screen and (max-width: 600px) {
        .container {
          width: 100% !important;
        }
      }
      a {
        color: #1648c0;
        text-decoration: none;
      }
    </style>
  </head>
  <body
    style="margin:0; padding:0; background-color:#f4f7ff; font-family: 'Outfit', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6;"
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      bgcolor="#f4f7ff"
      style="padding: 40px 0;"
    >
      <tr>
        <td align="center">
          <!-- Brand Row -->
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="max-width: 600px; margin-bottom: 20px;"
          >
            <tr>
              <td align="center" style="padding: 0 0 15px 0;">
                <img
                  src="${frontendUrl}/logo.webp"
                  alt="SmartStub"
                  height="36"
                  style="height: 36px; width: auto; vertical-align: middle; margin-right: 10px;"
                />
                <span
                  style="font-size: 20px; font-weight: 700; color: #07112b; vertical-align: middle;"
                  >SmartStub</span
                >
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
            style="max-width: 600px; border-radius: 16px; box-shadow: 0 4px 20px rgba(7,17,43,0.08); overflow: hidden;"
          >
            <!-- Header -->
            <tr>
              <td
                bgcolor="#07112b"
                style="background: linear-gradient(135deg, #07112b 0%, #0d2255 50%, #0b1e48 100%); padding: 28px; text-align: center;"
              >
                <h1
                  style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 0.3px;"
                >
                  Password Reset Request
                </h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td
                style="padding: 40px 30px; color: #334155; font-size: 16px; line-height: 1.6; text-align: center;"
              >
                <p style="margin: 0 0 15px 0;">Hi ${content.name},</p>
                <p style="margin: 0 0 30px 0;">
                  We received a request to reset your password. Click the
                  button below to choose a new one.
                </p>

                <!-- Call to Action -->
                <table
                  align="center"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="margin: 0 auto 30px auto;"
                >
                  <tr>
                    <td
                      style="border-radius: 12px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);"
                    >
                      <a
                        href="${frontendUrl}/${content.link}"
                        target="_blank"
                        style="display: inline-block; padding: 14px 32px; color: #ffffff; font-weight: 600; text-decoration: none;"
                        >Reset Password</a
                      >
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 10px 0; font-size: 14px; color: #5c6b82;">
                  If you did not request a password reset, please ignore this
                  email. The link will expire in
                  <strong style="color: #f04444;">1 hour</strong>.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="background-color: #f4f7ff; padding: 24px; text-align: center; font-size: 13px; color: #5c6b82; border-top: 1px solid #dde3ee;"
              >
                <p style="margin: 0 0 6px 0; font-weight: 600; color: #07112b;">
                  SmartStub
                </p>
                <p style="margin: 0;">
                  &copy; ${new Date().getFullYear()} SmartStub, Inc. Bank-level encryption &middot; your data is always private and secure.
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


};
