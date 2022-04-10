const outPath = `${__dirname}/../../out`;

export default {
  outPath,
  outDataPath: `${outPath}/data`,
  outImagesPath: `${outPath}/images`,
  storeTweetsPath: `${outPath}/data/tweets.json`,

  // Whether to store the fetched tweets locally (storeTweetsPath)
  storeTweets: true,
  // Whether to re/fetch the matching tweets and images from Twitter
  // or just generate the image based on the already fetched images (outImagePath)
  fetchTweets: true,
  // Hashtag to retrieve the tweets from
  hashtag: '#WeAreOkay',
  // Max to fetch tweets (if set to 'undefined' it will fetch all found tweets)
  fetchLimit: 10,

  // Background color of the generated image
  bgColor: '#FFF9EF', // '#19AB6D'
  // Name of the generated image
  imageName: 'demo04-09-2022.jpeg',
};
