import fs from 'fs';
import axios from 'axios';
import { hashImageBuffer } from './utlis';

export const readFile = async (filepath: string): Promise<Buffer> => {
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
  createHash = true,
  limit: number | null = null,
): Promise<ReadFilesFromDirResponseType> => {
  const filesObject: ReadFilesFromDirResponseType = {};
  const filesInDir = await readDir(dirpath);

  let loadedCount = 0;
  for (const key in filesInDir) {
    const filename = filesInDir[key];
    const buffer = await readFile(`${dirpath}/${filename}`);
    const hash = createHash ? await hashImageBuffer(buffer, filename) : null;
    filesObject[filename] = { buffer, hash, name: filename };
    loadedCount++;

    if (limit != null && loadedCount >= limit) {
      break;
    }
  }

  return filesObject;
};

export type LoadedImageType = {
  buffer: Buffer;
  hash: string | null;
  name: string;
};
export type ReadFilesFromDirResponseType = {
  [key: string]: LoadedImageType;
};

export const writeFile = async (
  filepath: string,
  data: Buffer | string,
): Promise<void> => {
  console.log('Info: Start Writing File', filepath);

  // Create dir
  const dirpath = filepath.substring(0, filepath.lastIndexOf('/'));
  if (dirpath !== '' && !doesDirExist(dirpath)) {
    await writeDir(dirpath);
  }

  return await new Promise((resolve, reject) => {
    fs.writeFile(filepath, data, 'utf-8', (err) => {
      if (err) {
        console.log('Error: Writing File', filepath);
        reject(err);
      }
      console.log('Info: End Writing File', filepath);
      resolve(undefined);
    });
  });
};

export const writeDir = async (dirpath: string): Promise<void> => {
  console.log('Info: Start Writing Dir', dirpath);

  // Check whether dir already exists
  if (doesDirExist(dirpath)) return Promise.resolve(undefined);

  return await new Promise((resolve, reject) => {
    fs.mkdir(dirpath, { recursive: true }, (err) => {
      if (err) {
        console.log('Error: Writing Dir', dirpath);
        reject(err);
      }
      console.log('Info: End Writing Dir', dirpath);
      resolve(undefined);
    });
  });
};

export const doesDirExist = (dirpath: string): boolean => {
  return fs.existsSync(dirpath);
};

export async function downloadImageFromUrl(
  url: string,
  imageName: string,
  imageDirPath: string,
) {
  const path = `${imageDirPath}/${imageName}`;

  // Create dir
  if (!doesDirExist(imageDirPath)) {
    await writeDir(imageDirPath);
  }

  // Fetch Image and save it to dir
  const response = await axios({
    url,
    responseType: 'stream',
  });
  await new Promise((resolve, reject) => {
    response.data
      .pipe(fs.createWriteStream(path))
      .on('finish', () => resolve(undefined))
      .on('error', (e) => reject(e));
  });
}
