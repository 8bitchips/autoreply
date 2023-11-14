const { google } = require("googleapis");

// Importing credentials from a separate file
const {
  CLIENT_ID,
  CLEINT_SECRET, // Typo: should be CLIENT_SECRET
  REDIRECT_URI,
  REFRESH_TOKEN,
} = require("./credentials");

// Creating an OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLEINT_SECRET, // Typo: should be CLIENT_SECRET
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Set to keep track of replied users
const repliedUsers = new Set();

// Function to check emails and send replies
async function checkEmailsAndSendReplies() {
  try {
    // Creating a Gmail client
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    
    // Listing unread messages
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
    });
    const messages = res.data.messages;

    // If there are unread messages
    if (messages && messages.length > 0) {
      // Loop through each message
      for (const message of messages) {
        // Get detailed information about the email
        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
        });

        // Extracting sender, recipient, and subject
        const from = email.data.payload.headers.find(
          (header) => header.name === "From"
        );
        const toHeader = email.data.payload.headers.find(
          (header) => header.name === "To"
        );
        const Subject = email.data.payload.headers.find(
          (header) => header.name === "Subject"
        );
        const From = from.value;
        const toEmail = toHeader.value;
        const subject = Subject.value;

        console.log("email come From", From);
        console.log("to Email", toEmail);

        // Check if already replied
        if (repliedUsers.has(From)) {
          console.log("Already replied to : ", From);
          continue;
        }

        // Get the thread and extract replies
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: message.threadId,
        });
        const replies = thread.data.messages.slice(1);

        // If no replies, send a reply
        if (replies.length === 0) {
          await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: await createReplyRaw(toEmail, From, subject),
            },
          });

          // Add a label to the email
          const labelName = "onVacation";
          await gmail.users.messages.modify({
            userId: "me",
            id: message.id,
            requestBody: {
              addLabelIds: [await createLabelIfNeeded(labelName)],
            },
          });

          console.log("Sent reply to email:", From);
          repliedUsers.add(From);
        }
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// Function to create a raw reply email
async function createReplyRaw(from, to, subject) {
  const emailContent = `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\nThank you for your message. I am unavailable right now, but will respond as soon as possible...`;
  const base64EncodedEmail = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return base64EncodedEmail;
}

// Function to create a label if it doesn't exist
async function createLabelIfNeeded(labelName) {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const res = await gmail.users.labels.list({ userId: "me" });
  const labels = res.data.labels;

  // Check if the label already exists
  const existingLabel = labels.find((label) => label.name === labelName);
  if (existingLabel) {
    return existingLabel.id;
  }

  // Create a new label
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });

  return newLabel.data.id;
}

// Function to generate a random interval
function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Set interval to run the email checking function at random intervals
setInterval(checkEmailsAndSendReplies, getRandomInterval(45, 120) * 1000);
