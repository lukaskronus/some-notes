const fs = require('fs');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/youtube'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';

// Load client secrets from a local file.
fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), createReusableStream);
});

// Create an OAuth2 client with the given credentials, and then execute the given callback function.
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return console.error('Error loading token file:', err);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

// Create a reusable stream.
async function createReusableStream(auth) {
  const youtube = google.youtube({ version: 'v3', auth });
  try {
    const stream = await youtube.liveStreams.insert({
      part: 'snippet,cdn,contentDetails',
      requestBody: {
        snippet: {
          title: 'Reusable Live Stream'
        },
        cdn: {
          frameRate: '30fps',
          ingestionType: 'rtmp',
          resolution: '1080p'
        },
        contentDetails: {
          isReusable: true
        }
      }
    });
    console.log('Reusable stream created:', stream.data.id);

    // Save the stream ID for later use
    fs.writeFileSync('stream_id.json', JSON.stringify({ streamId: stream.data.id }));
    console.log('Stream ID saved to stream_id.json');
  } catch (error) {
    console.error('Error creating reusable stream:', error);
  }
}
