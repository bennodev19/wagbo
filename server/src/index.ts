import {
  MediaObjectV2,
  TweetSearchRecentV2Paginator,
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
  console.log('Info: Start merging Images');

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
        width: 400,
        height: 400,
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

  if (images.length > 0) {
    // Strip some images to make it a square
    const colCount = Math.floor(Math.sqrt(images.length));
    const maxImagesCount = colCount * colCount;
    console.log('Info: Merge Images', {
      imagesCount: images.length,
      colCount,
      maxImagesCount,
    });

    // Merge Images
    const merge = new CanvasGrid({
      canvas: new Canvas(2, 2),
      bgColor: '#19AB6D',
      col: colCount,
      list: images.slice(0, maxImagesCount),
    });
    const buffer = merge.canvas.toBuffer();

    // Write Images
    fs.writeFileSync(`${config.app.outPath}/demo.jpeg`, buffer);
  }

  console.log('Info: End merging Images');
}

async function fetchImages(
  client: TwitterApi,
  options: FetchImagesOptionsType = {},
) {
  console.log('Info: Start fetching Images', options);

  const tweets: TweetsType = {};
  const processedTweets: string[] = [];

  // Load already processed tweets
  if (config.app.storeTweets) {
    try {
      const rawData = fs.readFileSync(config.app.storeTweetsPath);
      const data: JsonTweetType = JSON.parse(rawData.toString());
      const parsedTweets = data.data;
      for (const key of Object.keys(parsedTweets)) {
        tweets[key] = parsedTweets[key];
        processedTweets.push(key);
      }
    } catch (e) {
      console.log(
        `Warning: Couldn't find the json file where the tweets are stored in!`,
        config.app.storeTweetsPath,
      );
    }
  }

  // Fetch Tweet pages (via pagination based on next_token)
  // Query: https://developer.twitter.com/en/docs/twitter-api/tweets/counts/integrate/build-a-query
  // Pagination: https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/paginate
  let response: TweetSearchRecentV2Paginator;
  let nextToken: string | null = null;
  let pageCount = 1;
  do {
    console.log(`Info: Fetch Tweet page`, { nextToken, pageCount });

    // Fetch Tweet page
    response = await client.v2.search(
      //'#WeAreOkay has:media has:images -is:retweet',
      `${hashtag} has:media has:images -is:retweet`,
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
        'tweet.fields': ['created_at', 'author_id'],
        expansions: [
          'entities.mentions.username',
          'attachments.media_keys', // Required to fetch media
        ],
        start_time: options.startTime,
        end_time: options.endTime,
        max_results: 100, // Between 10 and 100
        next_token: nextToken || undefined,
      },
    );

    // Write raw Data Object for debugging and exploring the Twitter api response
    fs.writeFileSync(
      `${config.app.outDataPath}/rawData.json`,
      JSON.stringify(response, null, 2),
      'utf-8',
    );

    // Format Tweets and add them to the 'tweets' array
    const rawTweets = response.tweets;
    const includes = new TwitterV2IncludesHelper(response);
    for (const tweet of rawTweets) {
      tweets[tweet.id] = {
        ...tweet,
        medias: includes.medias(tweet),
      };
    }

    nextToken = response.meta.next_token ?? null;
    pageCount++;
  } while (nextToken != null);

  // Save all processed tweets (including the new ones)
  fs.writeFileSync(
    `${config.app.outDataPath}/tweets.json`,
    JSON.stringify(
      { count: Object.keys(tweets).length, data: tweets } as JsonTweetType,
      null,
      2,
    ),
    'utf-8',
  );

  // Fetch images from tweet and save it to local disk
  for (const key of Object.keys(tweets)) {
    const tweet = tweets[key];
    if (!processedTweets.includes(key)) {
      for (const media of tweet.medias) {
        const mediaUrl = media.url;
        if (mediaUrl != null) {
          const name = mediaUrl
            .substring(mediaUrl.lastIndexOf('/'))
            .replace('/', '');
          await downloadImageFromUrl(mediaUrl, name, config.app.outImagesPath);
        }
      }
    }
  }

  console.log('Info: End fetching Images');
}

async function main() {
  const client = new TwitterApi(config.twitter.bearerToken || 'unknown');
  const startTime = new Date('02 April 2022').toISOString();
  const endTime = new Date('07 April 2022').toISOString();

  if (fetch)
    await fetchImages(client, {
      startTime: startTime,
      endTime: endTime,
    });
  await mergeImages();
}

main();

type TweetType = {
  medias: MediaObjectV2[];
} & TweetV2;

type TweetsType = { [key: string]: TweetType };
type JsonTweetType = { count: number; data: TweetsType };

type FetchImagesOptionsType = {
  startTime?: string;
  endTime?: string;
};
