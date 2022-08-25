import http from 'http';
import piston from "piston-client";

http.createServer(function (req, res) {
  res.write('Hello World!'); 
  res.end();
}).listen(process.env.PORT || 8080); 

import { getMentions, getOnlyRepliedMentions, getTweet, replyMentionedTweets } from './lib/twitter.js';
import config from './config.js';

const pistonClient = piston({ server: "https://emkc.org" });

global.runtimes = await pistonClient.runtimes();

let username = config.username;
let userid = config.userid_str;

let lastMentionDetectionTime = new Date().toISOString();

let mentionDetectionInterval = setInterval(async () => {
  try {
    let allMentions = await getMentions(userid, lastMentionDetectionTime);
    // console.log(`${allMentions?.data?.length} mentions found.`);
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