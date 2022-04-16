const outDirPath = `${__dirname}/../../out`;

export default {
  outPath: outDirPath,
  outChunksDirPath: `${outDirPath}/chunks`,
  outDataDirPath: `${outDirPath}/data`,
  outImagesDirPath: `${outDirPath}/images`,
  outMapImagesDirPath: `${outDirPath}/map`,
  storeTweetsFilePath: `${outDirPath}/data/tweets.json`,

  // Whether to store the fetched tweets locally (storeTweetsPath)
  storeTweets: true,
  // Whether to re/fetch the matching tweets and images from Twitter
  // or just generate the image based on the already fetched images (outImagePath)
  fetchTweets: false,
  // Hashtag to retrieve the tweets from
  hashtag: '#WeAreOkay',
  // Max to fetch tweets (if set to 'undefined' it will fetch all found tweets)
  fetchLimit: undefined,
  // The oldest UTC timestamp from which the Tweets will be provided.
  // By default, a request will return Tweets from up to 30 days ago if you set it to 'undefined'.
  startTime: '12 April 2022',
  // The newest, most recent UTC timestamp to which the Tweets will be provided.
  // By default, a request will return Tweets until today if you set it to 'undefined'.
  endTime: '15 April 2022',

  // Background color of the generated image
  bgColor: '#FFF9EF', // '#19AB6D'
  // Name of the generated image
  imageName: 'demo04-16-2022',
  // Whether to split big image into multiple chunks
  chunks: 1,
  // Weather to filter duplicate images
  filterDuplicateImages: false,
  // How many images to load (if set to 'undefined' it will load all images)
  maxImageCount: null,
};
