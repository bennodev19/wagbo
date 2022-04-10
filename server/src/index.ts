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

async function mergeImagesFromHardDrive() {
  console.log('Info: Start loading Images from the hard drive');

  // Fetch raw images from local folder
  let rawImages: { [p: string]: Uint8Array } = {};
  try {
    rawImages = await readFilesFromDir(config.app.outImagesDirPath);
  } catch (e) {
    console.error("Info: Couldn't find images on hard drive!");
  }
  const imageBuffers: Buffer[] = [];
  for (const key in rawImages) imageBuffers.push(Buffer.from(rawImages[key]));

  console.log('Info: End loading Images from the hard drive');
  console.log('Info: Start resizing Images');

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

  console.log('Info: End resizing Images');

  // Split images into chunks
  const chunks: { image: Image }[][] = [];
  if (typeof config.app.chunks === 'number' && config.app.chunks > 0) {
    const chunksCount = config.app.chunks;
    const chunkSize = Math.floor(images.length / chunksCount);
    for (let i = 0; i < images.length; i += chunkSize) {
      const chunkImages = images.slice(i, i + chunkSize);
      // Add only complete chunks as the last one will only contain the remaining images
      if (chunkImages.length === chunkSize) chunks.push(chunkImages);
    }
    console.log('Info: Chunks Data', {
      chunksCount,
      chunkSize,
      chunks: chunks.map((i) => i.length),
    });
  } else {
    chunks.push(images);
  }

  // Strip excessive some images to make the final image chunk an even square
  const chunkColCount = Math.floor(Math.sqrt(chunks[0].length));
  const chunkImagesCount = chunkColCount * chunkColCount;

  console.log(`Info: Start merging Images`, {
    importedImagesCount: images.length,
    colCount: chunkColCount,
    imagesCount: chunkImagesCount * chunks.length,
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.length > 0) {
      console.log(`Info: Start creating Chunk ${i + 1}`, {
        chunkColCount,
        chunkImagesCount,
      });

      // Merge images to square canvas grid
      const merge = new CanvasGrid({
        canvas: new Canvas(2, 2),
        bgColor: config.app.bgColor,
        col: chunkColCount,
        list: chunk.slice(0, chunkImagesCount),
      });
      const buffer = merge.canvas.toBuffer();

      // Save generated image to the hard drive
      await writeFile(
        `${config.app.outChunksDirPath}/${config.app.imageName}${
          chunks.length > 1 ? `-${i + 1}` : ''
        }.jpeg`,
        buffer,
      );

      console.log(`Info: End creating Chunk ${i + 1}`);
    }
  }

  console.log('Info: End merging Images');
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
        await downloadImageFromUrl(mediaUrl, name, config.app.outImagesDirPath);
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

  // Already retrieved tweets
  const tweets: TweetsType = {};
  // Newly retrieved tweets
  const newTweets: TweetsType = {};

  // Load already retrieved tweets from the local hard drive
  if (config.app.storeTweets) {
    try {
      const rawData = await readFile(config.app.storeTweetsFilePath);
      const data: JsonTweetType = JSON.parse(rawData.toString());
      const parsedTweets = data.data;
      for (const key of Object.keys(parsedTweets)) {
        tweets[key] = parsedTweets[key];
      }
    } catch (e) {
      console.log(
        `Warning: Couldn't find the json file where the tweets are stored in!`,
        config.app.storeTweetsFilePath,
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
    // Calculation of the number of tweets to retrieve (maxResults) if a limit has been specified
    if (config.app.fetchLimit != null) {
      const left = config.app.fetchLimit - fetchedTweetsCount;
      maxResults = left > 100 ? 100 : left;
    }

    console.log(`Info: Fetch Tweet page`, {
      nextToken: nextPageToken,
      pageCount: currentPage,
      maxResults,
    });

    // Fetch next tweet page if more tweets need to be retrieved
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

      // Format Tweets and append them to the 'newTweets' array
      // if they weren't already retrieved in the past
      const rawTweets = response.tweets;
      const includes = new TwitterV2IncludesHelper(response);
      for (const rawTweet of rawTweets) {
        const tweet = {
          ...rawTweet,
          medias: includes.medias(rawTweet),
        };
        if (tweets[tweet.id] == null) {
          newTweets[tweet.id] = tweet;
          fetchedTweetsCount++;
        }
      }

      nextPageToken = response.meta.next_token ?? null;
      currentPage++;
    }
  } while (nextPageToken != null && maxResults > 0 && maxResults <= 100);

  // Save newly retrieved tweets (with the in the past retrieved tweets) to the local hard drive
  if (config.app.storeTweets) {
    const finalTweets = { ...tweets, ...newTweets };
    await writeFile(
      `${config.app.outDataDirPath}/tweets.json`,
      JSON.stringify(
        {
          count: Object.keys(finalTweets).length,
          data: finalTweets,
        } as JsonTweetType,
        null,
        2,
      ),
    );
  }

  // Fetch images of newly added tweets and save them to the local hard drive
  await fetchImages(newTweets);

  console.log('Info: End fetching Tweets', { fetchedTweetsCount });
}

async function main() {
  const client = new TwitterApi(config.twitter.bearerToken || 'unknown');
  const startTime =
    config.app.startTime != null
      ? new Date(config.app.startTime).toISOString()
      : undefined;
  const endTime =
    config.app.endTime != null
      ? new Date(config.app.endTime).toISOString()
      : undefined;

  if (config.app.fetchTweets)
    await fetchTweets(client, {
      startTime,
      endTime,
    });
  await mergeImagesFromHardDrive();
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
