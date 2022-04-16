import {
  MediaObjectV2,
  TweetSearchRecentV2Paginator,
  TweetV2,
  TwitterApi,
  TwitterV2IncludesHelper,
} from 'twitter-api-v2';
import CanvasGrid from 'merge-images-grid/cjs';
import config from './config';
import { Canvas, Image, loadImage } from 'canvas';
import {
  downloadImageFromUrl,
  LoadedImageType,
  readFile,
  readFilesFromDir,
  ReadFilesFromDirResponseType,
  writeFile,
} from './file';
import sharp from 'sharp';
import sizeOf from 'buffer-image-size';
import { rgb2lab, deltaE } from 'rgb-lab';

async function getImageOverAllColor(
  image: Buffer,
  imageWidth: number,
  imageHeight: number,
): Promise<OverAllColorType> {
  const canvas = new Canvas(imageWidth, imageHeight);
  const ctx = canvas.getContext('2d');
  const canvasImage = await loadImage(image);
  ctx.drawImage(canvasImage, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Detect brightness of image
  let colorSum = 0;
  const rgb: RGBType = { r: 0, g: 0, b: 0 };
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const avg = Math.floor((r + g + b) / 3);

    rgb.r += r;
    rgb.g += g;
    rgb.b += b;
    colorSum += avg;

    count++;
  }

  // ~~ used to floor values
  rgb.r = ~~(rgb.r / count);
  rgb.g = ~~(rgb.g / count);
  rgb.b = ~~(rgb.b / count);

  return {
    brightness: Math.floor(colorSum / (imageWidth * imageHeight)),
    overAllRgb: rgb,
  };
}

async function resizeImage(
  image: Buffer,
  imageWidth: number,
  imageHeight: number,
): Promise<Buffer> {
  return await sharp(image)
    .resize({
      fit: sharp.fit.cover,
      width: imageWidth,
      height: imageHeight,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function loadImagesFromHardDrive(
  dirPath: string,
): Promise<ReadFilesFromDirResponseType> {
  console.log('Info: Start loading Images from the hard drive');

  // Fetch raw images from local folder
  let loadedImages: ReadFilesFromDirResponseType = {};
  try {
    loadedImages = await readFilesFromDir(
      dirPath,
      config.app.filterDuplicateImages, // Hash is only required to filter duplicate images
      config.app.maxImageCount || undefined,
    );
  } catch (e) {
    console.error("Info: Couldn't find images on hard drive!");
  }

  console.log('Info: End loading Images from the hard drive');

  return loadedImages;
}

async function formatImages(
  images: ReadFilesFromDirResponseType,
  size = 400,
): Promise<FormattedImageType[]> {
  console.log('Info: Start formatting Images');

  // Formatted images (e.g. Resized to arrange them better in the canvas later)
  const formattedImages: FormattedImageType[] = [];
  // Key-value pair with the image hash and name(s) (for filtering duplicate images)
  const loadedImageNames: { [key: string]: string[] } = {};

  for (const key of Object.keys(images)) {
    const loadedImage = images[key];
    const loadedImageHash = loadedImage.hash;

    // Check whether the same image was already loaded
    if (loadedImageHash == null || loadedImageNames[loadedImageHash] == null) {
      // Resize Image
      const resizedImage = await resizeImage(loadedImage.buffer, size, size);

      // Transform to canvas image
      const canvasImage = await loadImage(resizedImage);

      // Detect image brightness
      const overAllColor = await getImageOverAllColor(resizedImage, size, size);

      formattedImages.push({
        hash: loadedImageHash,
        name: loadedImage.name,
        overAllColor,
        buffer: resizedImage,
        canvas: canvasImage,
      });

      // Add image name at image hash to 'loadedImageNames' to check later if the same image exists twice
      if (loadedImageHash != null) {
        loadedImageNames[loadedImageHash] = [loadedImage.name];
      }
    } else {
      loadedImageNames[loadedImageHash].push(loadedImage.name);
      console.log(
        `Info: Filtered duplicate image "${loadedImage.name}".`,
        loadedImageNames[loadedImageHash],
      );
    }
  }

  console.log('Info: End formatting Images');

  return formattedImages;
}

// async function mergeImagesFromHardDriveToEvenChunks() {
//   const loadedImages = await loadImagesFromHardDrive(
//     config.app.outImagesDirPath,
//   );
//   const formattedImages = await formatImages(loadedImages);
//
//   // Transform image buffers to Canvas-Images
//   const canvasImages: { image: Image }[] = formattedImages.map((i) => ({
//     image: i.canvas,
//   }));
//
//   // Split images into chunks
//   const chunks: { image: Image }[][] = [];
//   if (typeof config.app.chunks === 'number' && config.app.chunks > 0) {
//     const chunksCount = config.app.chunks;
//     const chunkSize = Math.floor(canvasImages.length / chunksCount);
//     for (let i = 0; i < canvasImages.length; i += chunkSize) {
//       const chunkImages = canvasImages.slice(i, i + chunkSize);
//       // Add only complete chunks as the last one will only contain the remaining images and won't be complete
//       if (chunkImages.length === chunkSize) chunks.push(chunkImages);
//     }
//     console.log('Info: Chunks Data', {
//       chunksCount,
//       chunkSize,
//       chunks: chunks.map((i) => i.length),
//     });
//   } else {
//     chunks.push(canvasImages);
//   }
//
//   // Strip excessive some images to make the final image chunk an even square
//   const chunkColCount = Math.floor(Math.sqrt(chunks[0].length));
//   const chunkImagesCount = chunkColCount * chunkColCount;
//
//   console.log(`Info: Start merging Images`, {
//     importedImagesCount: canvasImages.length,
//     colCount: chunkColCount,
//     imagesCount: chunkImagesCount * chunks.length,
//   });
//
//   // Merge images of chunks
//   for (let i = 0; i < chunks.length; i++) {
//     const chunk = chunks[i];
//     if (chunk.length > 0) {
//       console.log(`Info: Start creating Chunk ${i + 1}`, {
//         chunkColCount,
//         chunkImagesCount,
//       });
//
//       // Merge images to square canvas grid
//       const merge = new CanvasGrid({
//         canvas: new Canvas(2, 2),
//         bgColor: config.app.bgColor,
//         col: chunkColCount,
//         list: chunk.slice(0, chunkImagesCount),
//       });
//       const buffer = merge.canvas.toBuffer();
//
//       // Save generated image to the hard drive
//       await writeFile(
//         `${config.app.outChunksDirPath}/${config.app.imageName}${
//           chunks.length > 1 ? `-${i + 1}` : ''
//         }.jpeg`,
//         buffer,
//       );
//
//       console.log(`Info: End creating Chunk ${i + 1}`);
//     }
//   }
//
//   console.log('Info: End merging Images');
// }

async function mapToImage(image: Buffer): Promise<Buffer> {
  // Load image parts the final image consists off (pa = image part)
  const paImageSize = 100;
  const loadedImages = await loadImagesFromHardDrive(
    config.app.outImagesDirPath,
  );
  const paImages = await formatImages(loadedImages, paImageSize);

  const inDimensions = sizeOf(image);

  // Create input image canvas (in = input)
  const inCanvas = new Canvas(inDimensions.width, inDimensions.height);
  const inCtx = inCanvas.getContext('2d');
  const inImageCanvas = await loadImage(image);
  inCtx.drawImage(inImageCanvas, 0, 0);
  const inImageData = inCtx.getImageData(0, 0, inCanvas.width, inCanvas.height);

  // Create output image canvas
  const canvas = new Canvas(
    inDimensions.width * paImageSize,
    inDimensions.height * paImageSize,
  );
  const ctx = canvas.getContext('2d');

  // Iterate through the input image pixels
  // and replace them with the most suitible image in terms of color
  for (let y = 0; y < inImageData.height; y++) {
    for (let x = 0; x < inImageData.width; x++) {
      const n = y * (inImageData.width * 4) + x * 4;

      const r = inImageData.data[n];
      const g = inImageData.data[n + 1];
      const b = inImageData.data[n + 2];
      const avg = Math.floor((r + g + b) / 3);

      // Find closest image by brightness
      // const closest = paImages.reduce(function (prev, curr) {
      //   return Math.abs(curr.brightness - avg) < Math.abs(prev.brightness - avg)
      //     ? curr
      //     : prev;
      // });

      // Find closest image by overall color
      // https://stackoverflow.com/questions/13586999/color-difference-similarity-between-two-values-with-js
      const closest = paImages.reduce(function (prev, curr) {
        const lab = rgb2lab([r, g, b]);
        const prevLab = rgb2lab([
          prev.overAllColor.overAllRgb.r,
          prev.overAllColor.overAllRgb.g,
          prev.overAllColor.overAllRgb.b,
        ]);
        const currLab = rgb2lab([
          curr.overAllColor.overAllRgb.r,
          curr.overAllColor.overAllRgb.g,
          curr.overAllColor.overAllRgb.b,
        ]);
        return deltaE(lab, currLab) < deltaE(lab, prevLab) ? curr : prev;
      });

      // Draw Image (pixel) to canvas
      ctx.drawImage(closest.canvas, x * paImageSize, y * paImageSize);
    }
  }

  return canvas.toBuffer();
}

async function fetchImagesFromTweets(tweets: TweetsType) {
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
      //   `${config.app.outDataDirPath}/rawData.json`,
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
  await fetchImagesFromTweets(newTweets);

  console.log('Info: End fetching Tweets', { fetchedTweetsCount });
}

type TweetType = {
  medias: MediaObjectV2[];
} & TweetV2;

type TweetsType = { [key: string]: TweetType };
type JsonTweetType = { count: number; data: TweetsType };

type FetchImagesOptionsType = {
  startTime?: string;
  endTime?: string;
};

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

  // Fetch Tweets
  if (config.app.fetchTweets) {
    await fetchTweets(client, {
      startTime,
      endTime,
    });
  }

  // Merge images to chunks
  // await mergeImagesFromHardDriveToEvenChunks();

  // Map to Images
  const toMapImages = await loadImagesFromHardDrive(
    config.app.outImagesDirPath,
  );
  for (const key of Object.keys(toMapImages)) {
    const image = toMapImages[key];
    const formattedImage = await sharp(image.buffer)
      // .grayscale(true)
      .resize({ width: 200, height: 200 })
      .jpeg({ quality: 80 })
      .toBuffer();

    const mappedImage = await mapToImage(formattedImage);
    await writeFile(
      `${config.app.outMapImagesDirPath}/${image.name}_out.jpeg`,
      mappedImage,
    );
  }
}

main();

type OverAllColorType = {
  brightness: number;
  overAllRgb: RGBType;
};

type RGBType = { r: number; g: number; b: number };

type FormattedImageType = {
  overAllColor: OverAllColorType;
  canvas: Image;
} & LoadedImageType;
