import dotenv from 'dotenv';
import piston from "piston-client";
dotenv.config();
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import { getFirestore } from 'firebase-admin/firestore';
import admin from "./../database/admin.js";

const firestore = getFirestore();
const pistonClient = piston({ server: "https://emkc.org" });

// import config from '../config';


import config from '../config.js';

import fetch from 'node-fetch';

import Twit from 'twit';

var T = new Twit({
  consumer_key: process.env.API_KEY,
  consumer_secret: process.env.API_KEY_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,  // optional HTTP request timeout to apply to all requests.
  // strictSSL:            true,     // optional - requires SSL certificates to be valid.
})

// T.post('statuses/update', { status: 'hello world!' }, function(err, data, response) {
//   console.log(data)
// })

const getTweet = async (tweetId) => {
  let url = `https://api.twitter.com/1.1/statuses/show.json?id=${tweetId}&tweet_mode=extended`;
  let res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
    }
  });
  let data = await res.json();
  return data;
}

const getUser = async (userid) => {
  let url = `https://api.twitter.com/2/users/${userid}?user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified,withheld`;
  let res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
    }
  });
  let data = await res.json();
  return data;
}

const getMentions = async (userid, start_time) => {
  let url;
  try {
    if (start_time) {
      url = `https://api.twitter.com/2/users/${userid}/mentions?expansions=attachments.media_keys,author_id,entities.mentions.username,in_reply_to_user_id,referenced_tweets.id,referenced_tweets.id.author_id&tweet.fields=created_at&user.fields=name,username&start_time=${start_time}`;
    } else {
      url = `https://api.twitter.com/2/users/${userid}/mentions?expansions=attachments.media_keys,author_id,entities.mentions.username,in_reply_to_user_id,referenced_tweets.id,referenced_tweets.id.author_id&tweet.fields=created_at&user.fields=name,username`;
    }
    let response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
      }
    });
    let data = await response.json();
    // console.log(data);
    return data;
  } catch (error) {
    console.log(error);
  }
}

const replyMentionedTweets = async (mentionsArr, { statusText, statusTextFormatter }) => {
  if (!mentionsArr || mentionsArr.length == 0) {
    // throw new Error('Invalid parameters');
    return;
  };
  // console.log("someone mentioned: from replyMnetionedTweets function")
  // let url; 
  for (let mention of mentionsArr) {
    // if (!mention.in_reply_to_status_id_str) return;
    try {
      let tweetText = mention.text;
      if (mention.in_reply_to_user_id && (mention.referenced_tweets && mention.referenced_tweets.some(r => r.type == "replied_to"))) {
        let pTweet = await getTweet(mention.referenced_tweets.find(r => r.type == "replied_to").id);
        // console.log('ref: ',mention.referenced_tweets.find(r => r.type == "replied_to"));
        // console.log('ptwt: ',JSON.stringify(pTweet, null, 2));
        // return;
        if (pTweet.entities.user_mentions.find(user => user.id_str == config.userid_str) || pTweet.user.id_str == config.userid_str) {
          console.log("found a tweet that was replied to by the user");
          if (mention.text.match(new RegExp(`@${config.username}`, 'gi')).length <= 1) {
            console.log(`Ignoring repy to ${pTweet.user.screen_name} bcz I am mentioned in the main tweet`);
            continue;
          }
        }

      }

      let command;

      if ((new RegExp(`@${config.username}\\s+render\\b`, 'i')).test(mention.text)) {
        command = 'render';
      } else if ((new RegExp(`@${config.username}\\s+run\\b`, 'i')).test(mention.text)) {
        command = 'run';
      } else {
        continue;
      }

      if (!command) continue;

      // if (!(new RegExp(`@${config.username}\\s+render\\b`, 'i')).test(mention.text)
      //   && !(new RegExp(`@${config.username}\\s+run\\b`, 'i')).test(mention.text)
      // ) {
      //   continue;
      // }
      let codesObj = codeBlockParser(tweetText);
      let authorUser = await getUser(mention.author_id);
      switch (command) {
        case 'render':
          let content = "";
          let createdTime = new Date().getTime();
          let slug = generateSlug(createdTime);

          codesObj.forEach((e, i) => {
            e.code = e.code.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
            if (e.lang.toLowerCase() == 'html') {
              content += e.code;
            } else if (e.lang.toLowerCase() == 'css') {
              content += `<style>${e.code}</style>`;
            } else if (e.lang.toLowerCase() == 'js' || e.lang.toLowerCase() == 'javascript') {
              content += `<script>${e.code}</script>`;
            }
          });

          console.log('\x1b[36m%s\x1b[0m', `${content}`);

          if (!content || content.length < 1) continue;// message.channel.send("No code found!");
          // console.log(content);
          // message.channel.send(`\`\`\`html\n${content}\n\`\`\``);
          // return;

          // let authorUser = await getUser(mention.author_id);

          const post = {
            title: `${authorUser.data.name}'s page - Coderunner`,
            content: content.length > 0 ? content : 'No content',
            author: mention.author_id,
            createdAt: new Date(createdTime).toISOString(),
            lastUpdatedAt: new Date(createdTime).toISOString(),
            slug: slug
          }
          try {

            statusText = statusText || '';

            const postRef = firestore.collection('users').doc(mention.author_id).collection('userPosts').doc(slug);
            const newPost = await postRef.set(post);
            statusText += `page: https://codingbot.vercel.app/page/${post.author}/${slug}\ncode: https://codingbot.vercel.app/code/${post.author}/${slug}`;
            console.log('statusText: ', statusText);



          } catch (error) {
            loadMsg.edit('Error writing new post to database');
            console.error(error);
          }
          break;
        case 'run':
          try {
            let givenLang = codesObj[0].lang.toLowerCase().trim();
            codesObj[0].code = codesObj[0].code.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
            let lang = global.runtimes.find(r => r.language == givenLang) || global.runtimes.find(r => r.aliases.includes(givenLang))
            
            console.log('lang: ', lang);
            console.log('\n-------\n');
            console.log('codesObj[0].code: ', codesObj[0].code);
            console.log('\n-------\n');
            const codeResult = await pistonClient.execute(lang, codesObj[0].code);
            console.log(codeResult);
            console.log('\n-------\n');

            statusText = statusText || '';
            statusText += `${codeResult.run.output}`;

            let codeCreatedTime = new Date().getTime();
            let codeSlug = generateSlug(codeCreatedTime);

            let codeDetails = {
              title: `${authorUser.data.name}'s ${lang.language} code - Coderunner`,
              slug: codeSlug,
              code: codesObj[0].code,
              author: mention.author_id,
              output: codeResult.run.output,
              lang: lang.language,
              createdAt: new Date(codeCreatedTime).toISOString(),
              lastUpdatedAt: new Date(codeCreatedTime).toISOString(),
            }

            const codeRef = firestore.collection('users').doc(mention.author_id).collection('userCodes').doc(codeSlug);
            const newPost = await codeRef.set(codeDetails);

            // console.log('calc: ', statusText.length + authorUser.data.username.length + 1 + 100);
            if (statusText.length + authorUser.data.username.length + 1 + codeSlug.length + 13 > 280) {
              statusText = statusText.substring(0, 280 - authorUser.data.username.length - 5 - 100);
              statusText += '...';
            }
            statusText += `\ndetails: https://codingbot.vercel.app/output/${mention.author_id}/${codeSlug}`;

          } catch (error) {
            console.error(error);
          }

      }

      if (statusText && statusText.length > 0) {
        // console.log('\x1b[36m%s\x1b[0m', statusText);
        // console.log('\x1b[33m%s\x1b[0m', statusText.length);
        // url = `https://api.twitter.com/1.1/statuses/update.json?status=@${mention.username}%20${statusText}&in_reply_to_status_id=${mention.id}`;
        T.post(`statuses/update`, { status: `@${authorUser.data.username} ${statusText}`, in_reply_to_status_id: mention.id }, function (err, data, response) {
          if (err) return console.error(err);
          // console.log({ id: data.id_str, text: data.text, in_reply_to_status_id: data.in_reply_to_status_id_str });
          // console.log(data);
        })
      } else {
        console.log("No status text");
      }


      // let reDirectMsg = /location\.href|window.open|open/.test(content) ? `\nSeems like user is redirecting somewhere or opening a new tab.\n> Make sure user is not redirecting to any Malicious Site before opening the URL.\n` : '';
      // let scriptMsg = (/<script>|&lt;script&gt;/g).test(content) ? `\nSeems like user is adding script.\n> Make sure user is not adding any Malicious Script before opening the URL.\n` : '';

      // try {

      //   statusText = statusText || '';

      //   const newPost = await postRef.set(post);
      //   statusText += `page: https://codingbot.vercel.app/page/${post.author}/${slug}\ncode: https://codingbot.vercel.app/code/${post.author}/${slug}`;
      //   // loadMsg.edit(`slug: ${slug}\n> page: https://codingbot.vercel.app/page/${message.author.id}/${slug}\n> code: https://codingbot.vercel.app/code/${message.author.id}/${slug}${reDirectMsg}${scriptMsg}\n> Requested by: ${message.author.tag} (${message.author.id} | ${message.author})`);
      //   // if (args[0].toLowerCase() == "-p") loadMsg.reply(`https://s.vercel.app/api?url=https://codingbot.vercel.app/page/${message.author.id}/${slug}&width=1280&height=720`)
      //   console.log('statusText: ', statusText);

      //   if (statusText && statusText.length > 0) {
      //     // url = `https://api.twitter.com/1.1/statuses/update.json?status=@${mention.username}%20${statusText}&in_reply_to_status_id=${mention.id}`;
      //     T.post(`statuses/update`, { status: `@${authorUser.data.username} ${statusText}`, in_reply_to_status_id: mention.id }, function (err, data, response) {
      //       if (err) return console.error(err);
      //       console.log({ id: data.id_str, text: data.text, in_reply_to_status_id: data.in_reply_to_status_id_str });
      //       // console.log(data);
      //     })
      //   } else {
      //     console.log("No status text");
      //   }

      // } catch (error) {
      //   loadMsg.edit('Error writing new post to database');
      //   console.error(error);
      // }





      // //statusText = "test from terminal";
      // if (statusText) {
      //   // url = `https://api.twitter.com/1.1/statuses/update.json?status=@${mention.username}%20${statusText}&in_reply_to_status_id=${mention.id}`;
      //   T.post(`statuses/update`, { status: `@${mention.username} ${statusText}`, in_reply_to_status_id: mention.id, media_ids: media.media_id_string }, function (err, data, response) {
      //     console.log({ id: data.id_str, text: data.text, in_reply_to_status_id: data.in_reply_to_status_id_str });
      //   })
      // }
      // else if (statusTextFormatter) {
      //   // url = `https://api.twitter.com/1.1/statuses/update.json?status=@${mention.username}%20${statusTextFormatter(mention)}&in_reply_to_status_id=${mention.id}`;
      //   T.post('statuses/update', { status: `@${mention.username} ${statusTextFormatter(mention)}`, in_reply_to_status_id: mention.id, media_ids: media.media_id_string }, function (err, data, response) {
      //     console.log({ id: data.id_str, text: data.text, in_reply_to_status_id: data.in_reply_to_status_id_str });
      //   })
      // } else {
      //   // url = `https://api.twitter.com/1.1/statuses/update.json?status=@${mention.username}%20${statusText}&in_reply_to_status_id=${mention.id}`;
      //   T.post(`statuses/update`, { status: `@${mention.username}`, in_reply_to_status_id: mention.id, media_ids: media.media_id_string }, function (err, data, response) {
      //     console.log({ id: data.id_str, text: data.text, in_reply_to_status_id: data.in_reply_to_status_id_str });
      //   })
      // }

    } catch (error) {
      console.error(error);
    }

  }
  // console.log('-------------------');
  // try {
  //   // let url = `https://api.twitter.com/1.1/statuses/update.json?status=@${username}%20${statusText}&in_reply_to_status_id=${mentionsArr[0].id}`;
  //   let response = await fetch(url, {
  //     headers: {
  //       'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
  //     }
  //   });
  //   let data = await response.json();
  //   // console.log(data);
  //   return data;
  // } catch (error) {
  //   console.log(error);
  // }
}

// const getTweet = async (tweetId) => {
//   let url = `https://api.twitter.com/1.1/statuses/show.json?id=${tweetId}`;
//   let res = await fetch(url, {
//     headers: {
//       'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
//     }
//   });
//   let data = await res.json();
//   return data;
// }



const getOnlyRepliedMentions = async (mentionsArr, username) => {
  if (!mentionsArr || mentionsArr.length == 0 || !username) return;
  let repliedMentions = [];
  for (let mention of mentionsArr) {
    let tweet = await getTweet(mention.id);
    // console.log(tweet.in_reply_to_status_id_str && tweet.text.includes(username));
    if (tweet.in_reply_to_status_id_str && tweet.full_text.includes(username) && tweet.user.screen_name != username) {
      mention.in_reply_to_status_id_str = tweet.in_reply_to_status_id_str;
      mention.username = tweet.user.screen_name;
      repliedMentions.push(mention);
      // console.log(mention)
    }
  }
  return repliedMentions;
}



export { getUser, getMentions, getOnlyRepliedMentions, getTweet, replyMentionedTweets };


function generateSlug(time) {
  let timeString = time.toString(32);
  let slug = [...timeString].map(c => {
    if (randInt(0, 1) == 1) {
      return c + randInt(0, 20);
    } else {
      return c;
    }
  }).join('')
  return slug;
}

function randInt(min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function codeBlockParser(str) {
  const reg = /```(\S*)?(?:\s+)?\n((?:(?!```)[^])+)```/g;
  return [...str.matchAll(reg)]
    .map(e => ({ lang: e[1], code: e[2] }));
}