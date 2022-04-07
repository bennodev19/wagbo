import { TwitterApi } from 'twitter-api-v2';
import config from './config';

const hashtag = '#WeAreOkay';

async function main() {
  // Instantiate Twitter API Client
  const client = new TwitterApi(config.twitter.bearerToken || 'unknown');

  // Query: https://developer.twitter.com/en/docs/twitter-api/tweets/counts/integrate/build-a-query
  // Builder: https://developer.twitter.com/apitools/api?endpoint=%2F2%2Ftweets%2Fsearch%2Fall&method=get
  const tweets = await client.v2.search(
    '#WeAreOkay has:media has:images -is:retweet',
    {
      'media.fields': 'url',
      max_results: 10,
    },
  );

  // Consume every possible tweet of jsTweets (until rate limit is hit)
  for await (const tweet of tweets) {
    console.log(tweet);
  }
}

main();
