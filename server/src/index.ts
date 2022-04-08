import {TwitterApi} from 'twitter-api-v2';
import config from './config';
import * as fs from "fs";
import joinImages from "join-images";

const hashtag = '#WeAreOkay';

async function main() {
    // Instantiate Twitter API Client
    const client = new TwitterApi(config.twitter.bearerToken || 'unknown');

    // Merge Test
    // https://stackoverflow.com/questions/17369842/tile-four-images-together-using-node-js-and-graphicsmagick
    // https://www.youtube.com/watch?v=WtuJLcBvxI0
    const imageNames = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png'];
    console.log(imageNames.map(imageName => `${config.app.outImagesPath}/${imageName}`))

    joinImages(imageNames.map(imageName => `${config.app.outImagesPath}/${imageName}`)).then((img) => {
        // Save image as file
        img.toFile(`${config.app.outPath}/out.png`);
    });

    // // Query: https://developer.twitter.com/en/docs/twitter-api/tweets/counts/integrate/build-a-query
    // // Builder: https://developer.twitter.com/apitools/api?endpoint=%2F2%2Ftweets%2Fsearch%2Fall&method=get
    // const tweets = await client.v2.search(
    //     //'#WeAreOkay has:media has:images -is:retweet',
    //     '#WeAreOkay has:media has:images -is:retweet',
    //     {
    //         // https://developer.twitter.com/en/docs/twitter-api/data-dictionary/object-model/media
    //         'media.fields': ['media_key', 'preview_image_url', 'type', 'url', 'alt_text', 'width', 'height'],
    //         expansions: ['entities.mentions.username', "attachments.media_keys"],
    //         max_results: 10,
    //     }
    // );
    //
    // // Write Data Objects
    // fs.writeFileSync(`${config.app.outDataPath}/rawData.json`, JSON.stringify(tweets, null, 2) , 'utf-8');
}

main();
