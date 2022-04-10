# 🐻WAGBO Server
> We Are Gonna Be Okay 👌🐻

Retrieves images from tweets with the hashtag `#WeAreOkay`
and merges them into one big image. (like the below)

<img src="https://raw.githubusercontent.com/bennodev19/wagbo/master/static/wagbo.png" alt="Wagbo Example">

## 😇 Setup

1. Create [Twitter Developer Account](https://developer.twitter.com/en)
2. Create the file `.env.local` in the root of the `server` directory 
   and add the environment variable `TWITTER_BEARER_TOKEN` to it. 
   With the `TWITTER_BEARER_TOKEN` we authenticate ourselves to the Twitter api,
   so that we can programmatically fetch tweets.
   Replace `<BEARER_TOKEN_FROM_TWITTER>` with your Twitter `Bearer Token`.
   ```txt
   TWITTER_BEARER_TOKEN=<BEARER_TOKEN_FROM_TWITTER>
   ```
4. Run `yarn install` in the `server` directory to install all the required dependencies.
5. Configure `server/src/config/app.config.ts` to your needs.
6. Run `yarn run serve` in the `server` directory to generate the big image.
7. Take a look at the `output`.
   ```
   server
   ├── out
   │   └── data
   │   └── images
   │   └── chunks
   .
   ```
   - `data` contains all the already fetched tweets in `json` format
   - `images` contains all already retrieved images. These will be used to generate the final big image.
   - `chunks` contains all generated image chunks.

## 👨‍🎓 Learnings

### Search pagination
> https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/paginate

Search queries typically match on more Tweets than can be returned in a single API response. 
When that happens, the data is returned in a series of 'pages'. 
Pagination refers to methods for requesting all of the pages in order to retrieve the entire data set.
