import Buffer from 'buffer';
import { imageHash } from 'image-hash';

export async function hashImageBuffer(
  imageBuffer: Buffer,
  filename?: string,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    imageHash(
      { data: imageBuffer, name: filename },
      16,
      false,
      (error, data) => {
        if (error) throw error;
        resolve(data);
      },
    );
  });
}
