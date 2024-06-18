const fs = require('fs');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/youtube'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';
const STREAM_ID_PATH = 'stream_id.json';

// Load client secrets from a local file.
fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), scheduleStream);
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

// Schedule a live stream on YouTube.
async function scheduleStream(auth) {
  const youtube = google.youtube({ version: 'v3', auth });
  try {
    // Calculate the scheduled start time (current time + 1 hour)
    const currentTime = new Date();
    const startTime = new Date(currentTime.getTime() + 60 * 60 * 1000).toISOString();

    const broadcast = await youtube.liveBroadcasts.insert({
      part: 'snippet,status,contentDetails',
      requestBody: {
        snippet: {
          title: 'Scheduled Live Stream',
          description: 'Description of the live stream',
          scheduledStartTime: startTime
        },
        status: {
          privacyStatus: 'public'
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true
        }
      }
    });
    console.log('Broadcast created:', broadcast.data.id);

    // Load the reusable stream ID
    const streamIdData = fs.readFileSync(STREAM_ID_PATH, 'utf8');
    const streamId = JSON.parse(streamIdData).streamId;

    await youtube.liveBroadcasts.bind({
      part: 'id,contentDetails',
      id: broadcast.data.id,
      requestBody: {
        streamId: streamId
      }
    });
    console.log('Broadcast and reusable stream bound');

    // Optionally, retrieve and log the stream ingestion info
    const stream = await youtube.liveStreams.list({
      part: 'cdn',
      id: streamId
    });
    const ingestionInfo = stream.data.items[0].cdn.ingestionInfo;
    console.log(`Stream URL: ${ingestionInfo.ingestionAddress}`);
    console.log(`Stream Key: ${ingestionInfo.streamName}`);
  } catch (error) {
    console.error('Error scheduling stream:', error);
  }
}
