# 🐻WAGBO Server
> We Are Gonna Be Okay 👌🐻

Fetches tweets 

## 😇 Setup

1. Create [Twitter Developer Account](https://developer.twitter.com/en)
2. Create the file `.env.local` in the root of the `server` directory 
   and add the environment variable `TWITTER_BEARER_TOKEN`, 
   with which we authenticate ourselves to the Twitter api.
   Replace `<BEARER_TOKEN_FROM_TWITTER>` with your `Bearer Token`.
   ```txt
   TWITTER_BEARER_TOKEN=<BEARER_TOKEN_FROM_TWITTER>
   ```
3. Run `cd server` in the root of the directory 
   to execute the following commands in the `server` directory.
4. Run `yarn install` to install all required dependencies.
5. Configure `server/src/config/app.config.ts` to your needs
6. Run `yarn run serve` to generate the image.
7. Take a look at the `output`.
   ```
   server
   ├── out
   │   └── data
   │   └── images
   .
   ```
   - `data` contains all the already fetched tweets in `json` format
   - `images` contains all the already fetched images. These will be used to generate the final big image.

## 👨‍🎓 Learnings

### Search pagination
> https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/paginate

Search queries typically match on more Tweets than can be returned in a single API response. 
When that happens, the data is returned in a series of 'pages'. 
Pagination refers to methods for requesting all of the pages in order to retrieve the entire data set.