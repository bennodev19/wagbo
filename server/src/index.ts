import {
  MediaObjectV2,
  TweetV2,
  TwitterApi,
  TwitterV2IncludesHelper,
} from 'twitter-api-v2';
import config from './config';
import fs from 'fs';
import { Canvas, Image, loadImage } from 'canvas';
import CanvasGrid from 'merge-images-grid';
import { readFilesFromDir, downloadImageFromUrl } from './file';
import sharp from 'sharp';

const hashtag = '#WeAreOkay';
const fetch = false;

async function mergeImages() {
  // Fetch raw Images
  const rawImages = await readFilesFromDir(config.app.outImagesPath);
  const imageBuffers: Buffer[] = [];
  for (const key in rawImages) imageBuffers.push(Buffer.from(rawImages[key]));

  // Resize Images
  const resizedImageBuffers: Buffer[] = [];
  for (const imageBuffer of imageBuffers) {
    const resizedImage = await sharp(imageBuffer)
      .resize({
        fit: sharp.fit.cover,
        width: 800,
        height: 800,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    resizedImageBuffers.push(resizedImage);
  }

  // Transform raw Images to Canvas-Images
  const images: { image: Image }[] = [];
  for (const imageBuffer of resizedImageBuffers) {
    const image = await loadImage(imageBuffer);
    images.push({ image });
  }

  // Merge Images
  const merge = new CanvasGrid({
    canvas: new Canvas(2, 2),
    bgColor: '#19AB6D',
    list: images,
  });
  const buffer = merge.canvas.toBuffer();

  // Write Images
  fs.writeFileSync(`${config.app.outPath}/demo.png`, buffer);
}

async function fetchImages(client: TwitterApi) {
  // Fetch Tweets
  // Query: https://developer.twitter.com/en/docs/twitter-api/tweets/counts/integrate/build-a-query
  // Query Builder: https://developer.twitter.com/apitools/api?endpoint=%2F2%2Ftweets%2Fsearch%2Fall&method=get
  const response = await client.v2.search(
    //'#WeAreOkay has:media has:images -is:retweet',
    '#WeAreOkay has:media has:images -is:retweet',
    {
      // https://developer.twitter.com/en/docs/twitter-api/data-dictionary/object-model/media
      'media.fields': [
        'media_key',
        'preview_image_url',
        'type',
        'url',
        'width',
        'height',
      ],
      expansions: [
        'entities.mentions.username',
        'attachments.media_keys', // Required to fetch media
      ],
      start_time: '2022-04-07T00:00:00.000Z',
      max_results: 10,
    },
  );

  // Write raw Data Object for debugging and exploring the twitter api response
  fs.writeFileSync(
    `${config.app.outDataPath}/rawData.json`,
    JSON.stringify(response, null, 2),
    'utf-8',
  );

  // Extract Tweets and attach corresponding media
  const tweets = response.tweets;
  const includes = new TwitterV2IncludesHelper(response);
  const tweetsWithMedia: {
    tweet: TweetV2;
    medias: MediaObjectV2[];
  }[] = [];
  for (const tweet of tweets) {
    tweetsWithMedia.push({ tweet, medias: includes.medias(tweet) });
  }

  // Write 'tweetsWithMedia' Array for debugging
  fs.writeFileSync(
    `${config.app.outDataPath}/tweetsWithMedia.json`,
    JSON.stringify(tweetsWithMedia, null, 2),
    'utf-8',
  );

  // Fetch images from tweet and save it to local disk
  for (const tweetWithMedia of tweetsWithMedia) {
    for (const media of tweetWithMedia.medias) {
      const url = media.url;
      if (url != null) {
        const name = url.substring(url.lastIndexOf('/')).replace('/', '');
        await downloadImageFromUrl(url, name, config.app.outImagesPath);
      }
    }
  }
}

async function main() {
  // Instantiate Twitter API Client
  const client = new TwitterApi(config.twitter.bearerToken || 'unknown');

  if (fetch) await fetchImages(client);
  await mergeImages();
}

main();
