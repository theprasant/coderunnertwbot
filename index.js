import http from 'http';
import piston from "piston-client";

http.createServer(function (req, res) {
  res.write('Hello World!'); //write a response to the client
  res.end();
}).listen(process.env.PORT || 8080); //the server object listens on port 8080

import { getMentions, getOnlyRepliedMentions, getTweet, replyMentionedTweets } from './lib/twitter.js';

const pistonClient = piston({ server: "https://emkc.org" });

global.runtimes = await pistonClient.runtimes();

let username = 'testerOfPKS';
let userid = '1530255193090441216';
let lastMentionDetectionTime = new Date().toISOString();

let mentionDetectionInterval = setInterval(async () => {
  try {
    let allMentions = await getMentions(userid, lastMentionDetectionTime);
    if (allMentions && allMentions.data && allMentions.data.length) {
      let lastMentionTimeInMilisec = new Date(allMentions.data[0].created_at).getTime() + 1000;
      lastMentionDetectionTime = new Date(lastMentionTimeInMilisec).toISOString();
      await replyMentionedTweets(allMentions.data, { statusText: null, statusTextFormatter: null });
    }
  } catch (error) {
    console.error(error);
  }
}, 5_000);

console.log("Running...");