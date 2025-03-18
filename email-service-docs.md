# Email Service Testing Documentation

This document explains how to use the CLI commands for testing the EmailService functionality from the console.

## Prerequisites

1. Make sure you have configured the environment variables in your `.env` file:
   - `DATABASE_URL` - Connection string for your database
   - `UKR_NET_EMAIL` - Your Ukr.net email address
   - `UKR_NET_APP_PASSWORD` - Your Ukr.net app password
   - `UKR_NET_IMAP_HOST` - IMAP server host (default: `imap.ukr.net`)
   - `UKR_NET_SMTP_HOST` - SMTP server host (default: `smtp.ukr.net`)
   - `UKR_NET_SMTP_PORT` - SMTP server port (default: `465`)
   - `UKR_NET_SMTP_SECURE` - Whether to use secure connection (default: `true`)

2. Make sure your database is running and migrations have been applied.

## Available Commands

### Testing Email Server Connection

```bash
npm run email:connection
```

This command tests the connection to the configured email server (IMAP) and displays:
- Connection status (success/failure)
- Server hostname
- Username used
- Mailbox information (if available)

### Retrieving the Latest Verification Code

```bash
npm run email:latest-code
```

This command:
1. Connects to the email server
2. Searches for emails from TikTok's verification email address
3. Extracts the verification code from the most recent email
4. Stores the code in the database
5. Displays the extracted code and related information

### Waiting for a New Verification Code

```bash
npm run email:wait-code
```

This command:
1. Connects to the email server
2. Polls the server every few seconds for new verification emails
3. Terminates when either:
   - A verification code is found (success)
   - The timeout is reached (default: 60 seconds)

### Marking a Verification Code as Used

```bash
npm run email:mark-used ABCDEF
```

Replace `ABCDEF` with the actual verification code you want to mark as used. This command:
1. Looks up the code in the database
2. Updates its status to "USED"
3. Sets the `usedAt` timestamp to the current time

### Checking the Status of a Verification Code

```bash
npm run email:test -- status ABCDEF
```

Replace `ABCDEF` with the actual verification code you want to check. This command:
1. Looks up the code in the database
2. Displays its current status and related information

### General Command for All Email Tests

You can use the general email test command with any of the available subcommands:

```bash
npm run email:test -- <command> [arguments]
```

Where `<command>` can be:
- `connection`
- `latest-code`
- `wait-code`
- `mark-used <code>`
- `status <code>`
- `help`

## Troubleshooting

If you encounter issues:

1. Check the logs for detailed error messages
2. Verify that your environment variables are correctly set
3. Ensure your email credentials are valid
4. Make sure the database is accessible
5. Check your network connection and firewall settings to ensure access to the email server

## Example Output

### Successful Connection Test
```
✅ Connection successful!
- Host: imap.ukr.net
- User: your-email@ukr.net
- Mailbox: INBOX
- Messages: 42
```

### Failed Connection Test
```
❌ Connection failed!
- Error: Invalid credentials
- Host: imap.ukr.net
- User: your-email@ukr.net
```

### Successfully Retrieved Verification Code
```
✅ Verification code retrieved!
- Code: ABC123
- Received at: 3/18/2025, 15:42:30
- Status: UNUSED
- Message ID: 123456
- Sender: creativecenter@tiktok-for-business.com
```
