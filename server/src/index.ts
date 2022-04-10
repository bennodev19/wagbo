import {
  MediaObjectV2,
  TweetSearchRecentV2Paginator,
  TweetV2,
  TwitterApi,
  TwitterV2IncludesHelper,
} from 'twitter-api-v2';
import config from './config';
import { Canvas, Image, loadImage } from 'canvas';
import CanvasGrid from 'merge-images-grid';
import {
  readFilesFromDir,
  downloadImageFromUrl,
  writeFile,
  readFile,
} from './file';
import sharp from 'sharp';

async function mergeImages() {
  console.time('Info: Start fetching Images');

  // Fetch raw images from local folder
  let rawImages: { [p: string]: Uint8Array } = {};
  try {
    rawImages = await readFilesFromDir(config.app.outImagesPath);
  } catch (e) {
    console.log("Info: Couldn't find any image!");
  }
  const imageBuffers: Buffer[] = [];
  for (const key in rawImages) imageBuffers.push(Buffer.from(rawImages[key]));

  // Resize images to arrange it better in the canvas later
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

  // Transform image buffers to Canvas-Images
  const images: { image: Image }[] = [];
  for (const imageBuffer of resizedImageBuffers) {
    const image = await loadImage(imageBuffer);
    images.push({ image });
  }

  console.log('Info: End fetching Images');

  if (images.length > 0) {
    // Strip some images to make final image a even square
    const colCount = Math.floor(Math.sqrt(images.length));
    const maxImagesCount = colCount * colCount;
    console.log('Info: Start merging Images', {
      imagesCount: images.length,
      colCount,
      maxImagesCount,
    });

    // Merge images to canvas grid
    const merge = new CanvasGrid({
      canvas: new Canvas(2, 2),
      bgColor: config.app.bgColor,
      col: colCount,
      list: images.slice(0, maxImagesCount),
    });
    const buffer = merge.canvas.toBuffer();

    // Write merged image to local disk
    await writeFile(`${config.app.outPath}/${config.app.imageName}`, buffer);
  }

  console.time('Info: End merging Images');
}

async function fetchImages(tweets: TweetsType) {
  console.log('Info: Start fetching Images', Object.keys(tweets).length);

  for (const key of Object.keys(tweets)) {
    const tweet = tweets[key];
    if (tweet.medias.length > 0) {
      const mediaUrl = tweet.medias[0].url; // Only first image so there are no duplicate hands
      if (mediaUrl != null) {
        const name = mediaUrl
          .substring(mediaUrl.lastIndexOf('/'))
          .replace('/', '');
        await downloadImageFromUrl(mediaUrl, name, config.app.outImagesPath);
      }
    }
  }

  console.log('Info: End fetching Images');
}

async function fetchTweets(
  client: TwitterApi,
  options: FetchImagesOptionsType = {},
) {
  console.log('Info: Start fetching Tweets', options);

  // Already fetched tweets
  const tweets: TweetsType = {};
  // Newly fetched tweets
  const newTweets: TweetsType = {};

  // Load already processed tweets from the local disk
  if (config.app.storeTweets) {
    try {
      const rawData = await readFile(config.app.storeTweetsPath);
      const data: JsonTweetType = JSON.parse(rawData.toString());
      const parsedTweets = data.data;
      for (const key of Object.keys(parsedTweets)) {
        tweets[key] = parsedTweets[key];
      }
    } catch (e) {
      console.log(
        `Warning: Couldn't find the json file where the tweets are stored in!`,
        config.app.storeTweetsPath,
      );
    }
  }

  // Fetch all tweets based on the given query (via pagination based on next_token)
  // Query: https://developer.twitter.com/en/docs/twitter-api/tweets/counts/integrate/build-a-query
  // Pagination: https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/paginate
  let response: TweetSearchRecentV2Paginator;
  let nextPageToken: string | null = null;
  let currentPage = 1;
  let fetchedTweetsCount = 0;
  let maxResults = 100;
  do {
    // Calculate amount of to fetch tweets (maxResults), if a limit was specified
    if (config.app.fetchLimit != null) {
      const left = config.app.fetchLimit - fetchedTweetsCount;
      maxResults = left > 100 ? 100 : left;
    }

    console.log(`Info: Fetch Tweet page`, {
      nextToken: nextPageToken,
      pageCount: currentPage,
      maxResults,
    });

    // Fetch next tweet page, if more tweets need to be fetched
    if (maxResults > 0) {
      response = await client.v2.search(
        //'#WeAreOkay has:media has:images -is:retweet',
        `${config.app.hashtag} has:media has:images -is:retweet`,
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
          max_results: maxResults, // Has to be between 10 and 100
          next_token: nextPageToken || undefined,
        },
      );

      // Write raw Data Object for debugging and exploring the Twitter api response
      // await writeFile(
      //   `${config.app.outDataPath}/rawData.json`,
      //   JSON.stringify(response, null, 2),
      // );

      // Format Tweets and append them to the 'tweets' array
      const rawTweets = response.tweets;
      const includes = new TwitterV2IncludesHelper(response);
      for (const rawTweet of rawTweets) {
        const tweet = {
          ...rawTweet,
          medias: includes.medias(rawTweet),
        };
        tweets[tweet.id] = tweet;
        newTweets[tweet.id] = tweet;
        fetchedTweetsCount++;
      }

      nextPageToken = response.meta.next_token ?? null;
      currentPage++;
    }
  } while (nextPageToken != null && maxResults > 0 && maxResults <= 100);

  // Save all processed tweets (including the new ones) to the local disk
  await writeFile(
    `${config.app.outDataPath}/tweets.json`,
    JSON.stringify(
      { count: Object.keys(tweets).length, data: tweets } as JsonTweetType,
      null,
      2,
    ),
  );

  // Fetch images from newly added tweets and them to the local disk
  await fetchImages(newTweets);

  console.log('Info: End fetching Tweets', { fetchedTweetsCount });
}

async function main() {
  const client = new TwitterApi(config.twitter.bearerToken || 'unknown');
  const startTime = new Date('08 April 2022').toISOString();
  const endTime = new Date('09 April 2022').toISOString();

  if (config.app.fetchTweets)
    await fetchTweets(client, {
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
