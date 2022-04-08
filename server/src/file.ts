import fs from 'fs';
import axios from 'axios';

export const readFile = async (filepath: string): Promise<Uint8Array> => {
  console.log('Info: Start Reading File', filepath);
  return await new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, content) => {
      if (err) {
        console.log('Error: Reading File', filepath);
        reject(err);
      }
      console.log('Info: End Reading File', filepath);
      resolve(content);
    });
  });
};

export const readDir = async (dirpath: string): Promise<string[]> => {
  console.log('Info: Start Reading Dir', dirpath);
  return await new Promise((resolve, reject) => {
    fs.readdir(dirpath, (err, filenames) => {
      if (err) {
        console.log('Error: Reading Dir', dirpath);
        reject(err);
      }
      console.log('Info: End Reading Dir', dirpath, filenames);
      resolve(filenames);
    });
  });
};

export const readFilesFromDir = async (
  dirpath: string,
): Promise<{ [key: string]: Uint8Array }> => {
  const filesObject = {};
  const filesInDir = await readDir(dirpath);

  for (const key in filesInDir) {
    const filename = filesInDir[key];
    filesObject[filename] = await readFile(`${dirpath}/${filename}`);
  }

  return filesObject;
};

export async function downloadImageFromUrl(
  url: string,
  imageName: string,
  imagePath: string,
) {
  const path = `${imagePath}/${imageName}`;

  const response = await axios({
    url,
    responseType: 'stream',
  });

  await new Promise((resolve, reject) => {
    response.data
      .pipe(fs.createWriteStream(path))
      .on('finish', () => resolve(null))
      .on('error', (e) => reject(e));
  });
}
